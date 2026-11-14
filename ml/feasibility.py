"""Block 0 feasibility check for Tinta.

Questions:
  1. Does a trained model beat a simple rule (total time) on DARWIN?
  2. How much do we lose using only measures a phone can take?
  3. How much do we lose going from 25 tasks to 3 (tasks chosen inside each fold)?

Run:  python ml/feasibility.py
"""
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import RepeatedStratifiedKFold, StratifiedKFold, cross_val_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

DATA = Path(__file__).resolve().parent.parent / "data" / "darwin" / "data.csv"
N_TASKS = 25

# Measures that do not depend on the device: times and counts.
PHONE_SAFE = ["air_time", "paper_time", "total_time", "num_of_pendown"]
# Measures a phone can also take from the on-screen trace (units differ from the tablet).
PHONE_PLUS = PHONE_SAFE + [
    "mean_speed_on_paper", "mean_acc_on_paper", "mean_jerk_on_paper",
    "gmrt_on_paper", "max_x_extension", "max_y_extension", "disp_index",
]


def cols(measures, tasks):
    return [f"{m}{t}" for t in tasks for m in measures]


def logreg():
    return make_pipeline(StandardScaler(), LogisticRegression(C=0.1, max_iter=5000))


def forest():
    return RandomForestClassifier(n_estimators=400, random_state=0, n_jobs=-1)


def evaluate(make_model, X, y, select_tasks=None, measures=None, k_tasks=None, df=None):
    """Repeated 5-fold CV. If select_tasks, pick the k best tasks inside each training fold."""
    rskf = RepeatedStratifiedKFold(n_splits=5, n_repeats=5, random_state=0)
    acc, sens, spec, auc, picked = [], [], [], [], []
    for tr, te in rskf.split(X, y):
        if select_tasks:
            inner = StratifiedKFold(n_splits=4, shuffle=True, random_state=0)
            scores = {}
            for t in range(1, N_TASKS + 1):
                Xt = df.iloc[tr][cols(measures, [t])].values
                scores[t] = cross_val_score(logreg(), Xt, y[tr], cv=inner, scoring="roc_auc").mean()
            best = sorted(scores, key=scores.get, reverse=True)[:k_tasks]
            picked.append(tuple(sorted(best)))
            Xtr = df.iloc[tr][cols(measures, best)].values
            Xte = df.iloc[te][cols(measures, best)].values
        else:
            Xtr, Xte = X[tr], X[te]
        model = make_model().fit(Xtr, y[tr])
        p = model.predict_proba(Xte)[:, 1]
        pred = (p >= 0.5).astype(int)
        acc.append((pred == y[te]).mean())
        sens.append(pred[y[te] == 1].mean())
        spec.append(1 - pred[y[te] == 0].mean())
        auc.append(roc_auc_score(y[te], p))
    return dict(acc=np.mean(acc), acc_sd=np.std(acc), sens=np.mean(sens),
                spec=np.mean(spec), auc=np.mean(auc), picked=picked)


def show(name, r):
    print(f"{name:<46} acc {r['acc']:.3f} ±{r['acc_sd']:.3f} | "
          f"sens {r['sens']:.3f} | spec {r['spec']:.3f} | AUC {r['auc']:.3f}")


def main():
    df = pd.read_csv(DATA)
    y = (df["class"] == "P").astype(int).values
    all_tasks = list(range(1, N_TASKS + 1))
    print(f"{len(df)} people: {y.sum()} patients, {(1 - y).sum()} healthy\n")

    # Simple rule: total time over the 25 tasks (one number per person).
    total = np.log(df[cols(["total_time"], all_tasks)].sum(axis=1).values.reshape(-1, 1))
    show("Baseline: log total time, 25 tasks (1 number)", evaluate(logreg, total, y))

    all_measures = sorted({c.rstrip("0123456789") for c in df.columns} - {"ID", "class"})
    X_full = df[cols(all_measures, all_tasks)].values
    show("Full tablet: 450 measures, forest", evaluate(forest, X_full, y))
    show("Full tablet: 450 measures, logistic", evaluate(logreg, X_full, y))

    X_safe = df[cols(PHONE_SAFE, all_tasks)].values
    show("Phone-safe (times+counts), 25 tasks, forest", evaluate(forest, X_safe, y))
    show("Phone-safe (times+counts), 25 tasks, logistic", evaluate(logreg, X_safe, y))
    X_plus = df[cols(PHONE_PLUS, all_tasks)].values
    show("Phone-plus (+on-screen motion), 25 tasks, forest", evaluate(forest, X_plus, y))

    print("\nTasks chosen inside each fold (no peeking), phone-safe measures, logistic:")
    for k in (1, 2, 3, 5):
        r = evaluate(logreg, np.zeros((len(y), 1)), y, select_tasks=True, measures=PHONE_SAFE, k_tasks=k, df=df)
        show(f"  best {k} task(s)", r)
        if k == 3:
            from collections import Counter
            flat = Counter(t for combo in r["picked"] for t in combo)
            print("    how often each task was picked (of 25 folds):", flat.most_common(8))

    print("\nPer-task AUC with phone-safe measures (5-fold, logistic):")
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=0)
    per = {t: cross_val_score(logreg(), df[cols(PHONE_SAFE, [t])].values, y, cv=cv,
                              scoring="roc_auc").mean() for t in all_tasks}
    print("  " + ", ".join(f"T{t}:{a:.2f}" for t, a in sorted(per.items(), key=lambda kv: -kv[1])))


if __name__ == "__main__":
    main()
