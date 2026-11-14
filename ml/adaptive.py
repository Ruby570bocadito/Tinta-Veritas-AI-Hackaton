"""The adaptive test: a short check first, a closer look only when the short check is unsure.

Stage 1: 2 warm-ups + 3 scored tasks, logistic regression.
Stage 2 (only if stage 1 lands in the grey zone 35-65): 3 more tasks, and a blend of three models
         (logistic regression, RBF support vector machine, random forest) on all 6 tasks.

Everything is nested: tasks and model settings are chosen with the training people of each fold.

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

from device_shift import HARD, logit, pick, relative

warnings.filterwarnings("ignore")
DATA = Path(__file__).resolve().parent.parent / "data" / "darwin" / "data.csv"
LO, HI = 0.35, 0.65
INNER = StratifiedKFold(n_splits=4, shuffle=True, random_state=0)


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


def main():
    df = pd.read_csv(DATA)
    y = (df["class"] == "P").astype(int).values
    outer = RepeatedStratifiedKFold(n_splits=5, n_repeats=4, random_state=11)
    rows = {"short only (3 tasks)": [], "long only (6 tasks, blend)": [], "adaptive": []}
    escalated, still_unsure, decided_acc = [], [], []

    for fold, (tr, te) in enumerate(outer.split(df, y), 1):
        dtr, dte = df.iloc[tr], df.iloc[te]
        order = pick(dtr, y[tr], 6, logit, relative, HARD)
        p1 = stage1().fit(relative(dtr, order[:3]), y[tr]).predict_proba(relative(dte, order[:3]))[:, 1]
        members = [m.fit(relative(dtr, order), y[tr]) for m in stage2()]
        p2 = blend(members, relative(dte, order))
        grey = (p1 > LO) & (p1 < HI)
        final = np.where(grey, p2, p1)
        for name, p in (("short only (3 tasks)", p1), ("long only (6 tasks, blend)", p2), ("adaptive", final)):
            pred = (p >= 0.5).astype(int)
            rows[name].append(((pred == y[te]).mean(), pred[y[te] == 1].mean(), 1 - pred[y[te] == 0].mean(),
                               roc_auc_score(y[te], p)))
        escalated.append(grey.mean())
        unsure = (final > LO) & (final < HI)
        still_unsure.append(unsure.mean())
        decided_acc.append((((final >= 0.5).astype(int) == y[te])[~unsure]).mean())
        print(f"fold {fold}/20 done", flush=True)

    print("\nAccuracy on unseen people (5-fold x 4 repeats, fully nested)\n")
    for name, vals in rows.items():
        a = np.array(vals)
        m, s = a.mean(0), a.std(0)
        print(f"{name:<28} acc {m[0]:.3f} ±{s[0]:.3f} | sens {m[1]:.3f} | spec {m[2]:.3f} | AUC {m[3]:.3f}")
    print(f"\nPeople sent to the closer look: {np.mean(escalated):.1%}")
    print(f"Average number of scored tasks: {3 + 3 * np.mean(escalated):.2f}")
    print(f"Still 'I can't tell' after the closer look: {np.mean(still_unsure):.1%}")
    print(f"Accuracy among the people who get a clear answer: {np.mean(decided_acc):.3f}")


if __name__ == "__main__":
    main()
