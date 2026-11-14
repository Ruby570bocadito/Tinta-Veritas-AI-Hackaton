"""Which model, if any, adds something beyond a fair stopwatch?

Same people, same folds, same tasks for every method, so differences come from the method.
Task sets: all 25, the 16 phone-feasible ones, and the stopwatch's own best 5 and 3 (chosen in-fold).

Run:  python ml/model_search.py
"""
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import RepeatedStratifiedKFold

from experiments import POOL, Stopwatch, forward_select, stopwatch

DATA = Path(__file__).resolve().parent.parent / "data" / "darwin" / "data.csv"


def raw(df, tasks):
    """Per task: log air, log paper, log total, log pen-downs."""
    names = [f"{m}{t}" for t in tasks for m in ("air_time", "paper_time", "total_time", "num_of_pendown")]
    return np.log1p(df[names].values.astype(float))


def shaped(df, tasks):
    """Per task, measures that do not depend on the device or on how long the task is:
    log total time, share of time in the air, log pen-downs, log mean pause, log mean stroke."""
    cols = []
    for t in tasks:
        air, paper = df[f"air_time{t}"].values.astype(float), df[f"paper_time{t}"].values.astype(float)
        total, n = df[f"total_time{t}"].values.astype(float), df[f"num_of_pendown{t}"].values.astype(float)
        cols += [np.log1p(total), air / np.maximum(total, 1), np.log1p(n),
                 np.log1p(air / np.maximum(n, 1)), np.log1p(paper / np.maximum(n, 1))]
    return np.column_stack(cols)


class Pooled:
    """Low-variance model: standardise each measure per task, average it across tasks,
    then a logistic regression on the 5 averages. Each task counts the same."""

    def __init__(self, n_measures=5):
        self.k = n_measures

    def _pool(self, X):
        z = (X - self.mu) / self.sd
        return np.column_stack([z[:, i::self.k].mean(1) for i in range(self.k)])

    def fit(self, X, y):
        self.mu, self.sd = X.mean(0), X.std(0) + 1e-9
        self.m = LogisticRegression(C=1.0, max_iter=5000).fit(self._pool(X), y)
        return self

    def proba(self, X):
        return self.m.predict_proba(self._pool(X))[:, 1]


class Sk:
    def __init__(self, make, scale=False):
        self.make, self.scale = make, scale

    def fit(self, X, y):
        self.mu, self.sd = (X.mean(0), X.std(0) + 1e-9) if self.scale else (0, 1)
        self.m = self.make().fit((X - self.mu) / self.sd, y)
        return self

    def proba(self, X):
        return self.m.predict_proba((X - self.mu) / self.sd)[:, 1]


METHODS = {
    "stopwatch rule (equal weights)": (stopwatch, lambda: Stopwatch()),
    "logistic, raw times": (raw, lambda: Sk(lambda: LogisticRegression(C=0.3, max_iter=5000), scale=True)),
    "logistic, shaped measures": (shaped, lambda: Sk(lambda: LogisticRegression(C=0.1, max_iter=5000), scale=True)),
    "pooled (5 averages)": (shaped, lambda: Pooled()),
    "random forest, shaped": (shaped, lambda: Sk(lambda: RandomForestClassifier(500, random_state=0, n_jobs=-1))),
    "gradient boosting, shaped": (shaped, lambda: Sk(lambda: HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=200, random_state=0))),
}


def main():
    df = pd.read_csv(DATA)
    y = (df["class"] == "P").astype(int).values
    outer = RepeatedStratifiedKFold(n_splits=5, n_repeats=4, random_state=1)
    sets = ["all 25 tasks", "16 phone tasks", "best 5 (in-fold)", "best 3 (in-fold)"]
    res = {s: {m: [] for m in METHODS} for s in sets}
    for tr, te in outer.split(df, y):
        dtr, dte = df.iloc[tr], df.iloc[te]
        order = forward_select(dtr, y[tr], 5, make=Stopwatch, feats=stopwatch)
        tasks = {"all 25 tasks": list(range(1, 26)), "16 phone tasks": POOL,
                 "best 5 (in-fold)": order[:5], "best 3 (in-fold)": order[:3]}
        for s in sets:
            for name, (feats, make) in METHODS.items():
                p = make().fit(feats(dtr, tasks[s]), y[tr]).proba(feats(dte, tasks[s]))
                pred = (p >= 0.5).astype(int)
                res[s][name].append(((pred == y[te]).mean(), pred[y[te] == 1].mean(),
                                     1 - pred[y[te] == 0].mean(), roc_auc_score(y[te], p)))
    for s in sets:
        print(f"\n== {s} ==")
        for name in METHODS:
            a = np.array(res[s][name])
            m, sd = a.mean(0), a.std(0)
            print(f"  {name:<32} acc {m[0]:.3f} ±{sd[0]:.3f} | sens {m[1]:.3f} | spec {m[2]:.3f} | AUC {m[3]:.3f}")


if __name__ == "__main__":
    main()
