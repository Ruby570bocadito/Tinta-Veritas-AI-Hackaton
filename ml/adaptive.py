"""The adaptive test: a short check first, a closer look only when the short check is unsure.

Stage 1: 3 scored tasks, logistic regression on two measures per task
         (share of time in the air, number of touches). Two practice tasks come first; they are not scored.
Stage 2 (only if stage 1 lands in the grey zone 35-65): 3 more tasks, and a blend of three models
         (logistic regression, RBF support vector machine, random forest) on all 6 tasks.

The three extra tasks are fixed (CLOSER below): short ones where people lift the pen. The first version let the
data choose them and it chose two phone numbers; volunteers found those long. Both versions are measured here.

Everything else is nested: the short check's tasks and all model settings are chosen with the training people of each fold.

Run:  python ml/adaptive.py
"""
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import GridSearchCV, RepeatedStratifiedKFold, StratifiedKFold, cross_val_predict
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

from device_shift import HARD, logit, pick, shape

warnings.filterwarnings("ignore")
DATA = Path(__file__).resolve().parent.parent / "data" / "darwin" / "data.csv"
LO, HI = 0.35, 0.65
SPLIT = 0.5  # if the three models disagree by more than this, the answer is "I can't tell"
INNER = StratifiedKFold(n_splits=4, shuffle=True, random_state=0)

# The closer look: three letters to copy (6), a word to copy (10), the name of an object in a picture (18).
# Chosen by a rule that never looks at who is ill, among the tasks a finger can do:
#   - short: the median person in the study does it in four or five pen-downs (the phone numbers take twelve);
#   - lifted: hardly anyone writes it in one stroke. On a phone a single stroke leaves no pause to time,
#     which is what our own volunteers showed on the backwards word (ml/own_data.py).
# why_these() prints the numbers behind the rule. The backwards word (16) also passes it; the short check has it already.
CLOSER = [6, 10, 18]


def why_these(df):
    print("Why these three tasks for the closer look (everyone in the study, no diagnosis involved):")
    print(f"{'task':>6}{'median seconds':>16}{'median pen-downs':>18}{'done in one stroke':>20}")
    for t in HARD:
        n = df[f"num_of_pendown{t}"]
        mark = "  <- closer look" if t in CLOSER else ""
        print(f"{t:>6}{df[f'total_time{t}'].median() / 1000:>16.1f}{n.median():>18.0f}{f'{int((n <= 1).sum())} of {len(df)}':>20}{mark}")
    print()


def more_tasks(d, y, chosen, k):
    """Carry on the forward selection from the tasks already fixed: the closer look the data would choose."""
    chosen = list(chosen)
    for _ in range(k):
        def score(t):
            X = shape(d, chosen + [t])
            return np.mean([roc_auc_score(y[b], logit().fit(X[a], y[a]).proba(X[b])) for a, b in INNER.split(X, y)])
        chosen.append(max([t for t in HARD if t not in chosen], key=score))
    return chosen


def tuned(model, params):
    return GridSearchCV(make_pipeline(StandardScaler(), model), params, cv=INNER, scoring="roc_auc", n_jobs=-1)


class CalibratedSVM:
    """RBF support vector machine whose score is turned into a probability by a one-variable
    logistic regression (Platt scaling) fitted on out-of-fold scores. Written out by hand so the
    browser can repeat exactly the same arithmetic."""

    def fit(self, X, y):
        search = tuned(SVC(), {"svc__C": [0.3, 1, 3, 10], "svc__gamma": ["scale", 0.01, 0.03]}).fit(X, y)
        self.best_estimator_, self.best_params_ = search.best_estimator_, search.best_params_
        scores = cross_val_predict(self.best_estimator_, X, y, cv=INNER, method="decision_function")
        platt = LogisticRegression(C=1e6, max_iter=5000).fit(scores.reshape(-1, 1), y)
        self.a, self.b = float(platt.coef_[0][0]), float(platt.intercept_[0])
        return self

    def predict_proba(self, X):
        p = 1 / (1 + np.exp(-(self.a * self.best_estimator_.decision_function(X) + self.b)))
        return np.column_stack([1 - p, p])


def stage1():
    return tuned(LogisticRegression(max_iter=5000), {"logisticregression__C": [0.03, 0.1, 0.3, 1, 3]})


def stage2():
    """The three members of the blend. Their probabilities are averaged."""
    return [
        tuned(LogisticRegression(max_iter=5000), {"logisticregression__C": [0.03, 0.1, 0.3, 1, 3]}),
        CalibratedSVM(),
        tuned(RandomForestClassifier(150, random_state=0),
              {"randomforestclassifier__max_depth": [3, 5], "randomforestclassifier__min_samples_leaf": [1, 3, 5]}),
    ]


def blend(models, X):
    return np.mean([m.predict_proba(X)[:, 1] for m in models], axis=0)


def disagreement(models, X):
    """Gap between the most and the least worried of the three models."""
    votes = np.array([m.predict_proba(X)[:, 1] for m in models])
    return votes.max(axis=0) - votes.min(axis=0)


def told(final, unsure):
    """What the person is told: 0 usual pattern, 1 I can't tell, 2 worth mentioning."""
    return np.where(unsure, 1, np.where(final >= HI, 2, 0))


def main():
    df = pd.read_csv(DATA)
    y = (df["class"] == "P").astype(int).values
    outer = RepeatedStratifiedKFold(n_splits=5, n_repeats=4, random_state=11)
    why_these(df)
    rows = {"short only (3 tasks)": [], "long only (all tasks, blend)": [], "adaptive": [],
            "adaptive, closer look chosen by the data": []}
    escalated, still_unsure, decided_acc, split_fired, sizes, old_unsure = [], [], [], [], [], []
    chosen_by_data = {}
    table = np.zeros((2, 3))  # rows: healthy, patient; columns: usual, can't tell, worth mentioning
    short_table = np.zeros((2, 3))

    for fold, (tr, te) in enumerate(outer.split(df, y), 1):
        dtr, dte = df.iloc[tr], df.iloc[te]
        first = pick(dtr, y[tr], 3, logit, shape, HARD)
        order = first + [t for t in CLOSER if t not in first]
        sizes.append(len(order))
        p1 = stage1().fit(shape(dtr, first), y[tr]).predict_proba(shape(dte, first))[:, 1]
        members = [m.fit(shape(dtr, order), y[tr]) for m in stage2()]
        p2 = blend(members, shape(dte, order))
        grey = (p1 > LO) & (p1 < HI)
        final = np.where(grey, p2, p1)
        # For comparison only: the first version, where forward selection chose the three extra tasks.
        free = more_tasks(dtr, y[tr], first, 3)
        for t in free[3:]:
            chosen_by_data[t] = chosen_by_data.get(t, 0) + 1
        old_members = [m.fit(shape(dtr, free), y[tr]) for m in stage2()]
        old_final = np.where(grey, blend(old_members, shape(dte, free)), p1)
        old_unsure.append((((old_final > LO) & (old_final < HI)) | (grey & (disagreement(old_members, shape(dte, free)) > SPLIT))).mean())
        for name, p in (("short only (3 tasks)", p1), ("long only (all tasks, blend)", p2), ("adaptive", final),
                        ("adaptive, closer look chosen by the data", old_final)):
            pred = (p >= 0.5).astype(int)
            rows[name].append(((pred == y[te]).mean(), pred[y[te] == 1].mean(), 1 - pred[y[te] == 0].mean(),
                               roc_auc_score(y[te], p)))
        escalated.append(grey.mean())
        # Unsure if the final score is in the grey zone, or if the three models pull far apart.
        split = grey & (disagreement(members, shape(dte, order)) > SPLIT)
        split_fired.append(split.mean())
        unsure = ((final > LO) & (final < HI)) | split
        for label in (0, 1):
            who = y[te] == label
            table[label] += np.bincount(told(final, unsure)[who], minlength=3)
            short_table[label] += np.bincount(told(p1, grey)[who], minlength=3)
        still_unsure.append(unsure.mean())
        decided_acc.append((((final >= 0.5).astype(int) == y[te])[~unsure]).mean())
        print(f"fold {fold}/20 done", flush=True)

    print("\nAccuracy on unseen people (5-fold x 4 repeats, fully nested)\n")
    for name, vals in rows.items():
        a = np.array(vals)
        m, s = a.mean(0), a.std(0)
        print(f"{name:<42} acc {m[0]:.3f} ±{s[0]:.3f} | sens {m[1]:.3f} | spec {m[2]:.3f} | AUC {m[3]:.3f}"
              f"   = {100 * m[0]:.1f}% right, {100 * m[1]:.1f}% of patients caught, {100 * (1 - m[2]):.1f}% of healthy people flagged")
    print("\n'adaptive' is what the app does: the short check, then the closer look with tasks", CLOSER, "when it is unsure.")
    print("The last row is the first version, kept for comparison: there the data chose the three extra tasks,")
    print("most often", ", ".join(f"task {t} ({n} of 20 folds)" for t, n in sorted(chosen_by_data.items(), key=lambda kv: -kv[1])[:4]) + ".")
    print(f"Still 'I can't tell' with the closer look chosen by the data: {np.mean(old_unsure):.1%}")
    print(f"\nPeople sent to the closer look: {np.mean(escalated):.1%}")
    print(f"Average number of scored tasks: {3 + np.mean([(n - 3) * e for n, e in zip(sizes, escalated)]):.2f}"
          f"  (the closer look adds {np.mean(sizes) - 3:.1f} tasks on average: fewer than 3 when the short check of a fold already has one of them)")
    print(f"Still 'I can't tell' after the closer look: {np.mean(still_unsure):.1%}")
    print(f"Accuracy among the people who get a clear answer: {np.mean(decided_acc):.3f}")
    print(f"The three models disagree by more than {SPLIT:.0%}: {np.mean(split_fired):.1%} of people")
    for name, t in (("short check only", short_table), ("adaptive check (what the app does)", table)):
        print(f"\nWhat people are told, {name} (share of each group):")
        print(f"{'':<10}{'usual pattern':>15}{'I cannot tell':>15}{'worth mentioning':>18}")
        for label, who in ((1, "patients"), (0, "healthy")):
            r = t[label] / t[label].sum()
            print(f"{who:<10}{r[0]:>15.0%}{r[1]:>15.0%}{r[2]:>18.0%}")


if __name__ == "__main__":
    main()
