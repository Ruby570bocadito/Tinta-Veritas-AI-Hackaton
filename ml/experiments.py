"""Block 2: can a trained model beat a stopwatch with only a few tasks?

Everything that is chosen (which tasks, in which order) is chosen inside the
training part of each fold, so the test people never influence the design.

Compares, for k = 1..8 tasks picked by forward selection:
  - stopwatch rule: log of the summed total time of those k tasks
  - model: logistic regression on log(times and pen-down counts) of those k tasks
And an adaptive test: stop early when the model is confident, else ask one more task.

Run:  python ml/experiments.py
"""
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import RepeatedStratifiedKFold, StratifiedKFold

DATA = Path(__file__).resolve().parent.parent / "data" / "darwin" / "data.csv"
MEASURES = ["air_time", "paper_time", "total_time", "num_of_pendown"]
MAX_K = 8
# Tasks that make sense with a finger on a phone screen. Decided before looking at results:
# no signature (privacy), no forms/boxes/rows/lines that need a paper layout (7, 11, 13, 17, 19),
# no 6 cm circle (wider than many phones), no full paragraph (25), no complex figure (21).
POOL = [2, 3, 5, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 22, 23, 24]
LO, HI = 0.25, 0.75  # adaptive test: stop when the score is outside this band


def block(df, tasks):
    return np.log1p(df[[f"{m}{t}" for t in tasks for m in MEASURES]].values.astype(float))


def stopwatch(df, tasks):
    """One column per task: log total time. The rule averages them with equal weight."""
    return np.log(df[[f"total_time{t}" for t in tasks]].values.astype(float))


class Stopwatch:
    """Simple rule: average the standardised log times (each task counts the same), one threshold."""

    def fit(self, X, y):
        self.mu, self.sd = X.mean(0), X.std(0) + 1e-9
        z = self._z(X).reshape(-1, 1)
        self.m = LogisticRegression(C=1e6, max_iter=5000).fit(z, y)
        return self

    def _z(self, X):
        return ((X - self.mu) / self.sd).mean(1)

    def proba(self, X):
        return self.m.predict_proba(self._z(X).reshape(-1, 1))[:, 1]


class Scaled:
    """Standardise with training statistics, then logistic regression."""

    def __init__(self, C=0.3):
        self.m = LogisticRegression(C=C, max_iter=5000)

    def fit(self, X, y):
        self.mu, self.sd = X.mean(0), X.std(0) + 1e-9
        self.m.fit((X - self.mu) / self.sd, y)
        return self

    def proba(self, X):
        return self.m.predict_proba((X - self.mu) / self.sd)[:, 1]


def inner_auc(make, X, y):
    cv = StratifiedKFold(n_splits=4, shuffle=True, random_state=0)
    out = []
    for a, b in cv.split(X, y):
        out.append(roc_auc_score(y[b], make().fit(X[a], y[a]).proba(X[b])))
    return float(np.mean(out))


def forward_select(df, y, k, make=Scaled, feats=None):
    feats = feats or block
    chosen = []
    for _ in range(k):
        rest = [t for t in POOL if t not in chosen]
        best = max(rest, key=lambda t: inner_auc(make, feats(df, chosen + [t]), y))
        chosen.append(best)
    return chosen


def rates(y, pred):
    return (pred == y).mean(), pred[y == 1].mean(), 1 - pred[y == 0].mean()


def main():
    df = pd.read_csv(DATA)
    y = (df["class"] == "P").astype(int).values
    outer = RepeatedStratifiedKFold(n_splits=5, n_repeats=3, random_state=0)
    res = {k: {"model": [], "watch": []} for k in range(1, MAX_K + 1)}
    adaptive, used, orders = [], [], []

    for tr, te in outer.split(df, y):
        dtr, dte = df.iloc[tr], df.iloc[te]
        order = forward_select(dtr, y[tr], MAX_K)
        worder = forward_select(dtr, y[tr], MAX_K, make=Stopwatch, feats=stopwatch)  # its own best tasks
        orders.append(tuple(order))
        probs = []
        for k in range(1, MAX_K + 1):
            tasks = order[:k]
            p = Scaled().fit(block(dtr, tasks), y[tr]).proba(block(dte, tasks))
            w = Stopwatch().fit(stopwatch(dtr, worder[:k]), y[tr]).proba(stopwatch(dte, worder[:k]))
            probs.append(p)
            res[k]["model"].append((*rates(y[te], (p >= 0.5).astype(int)), roc_auc_score(y[te], p)))
            res[k]["watch"].append((*rates(y[te], (w >= 0.5).astype(int)), roc_auc_score(y[te], w)))
        # Adaptive: start with 3 tasks, add one at a time while the score is in the grey band.
        final = np.zeros(len(te))
        n_used = np.zeros(len(te))
        for i in range(len(te)):
            for k in range(3, MAX_K + 1):
                final[i], n_used[i] = probs[k - 1][i], k
                if not LO < final[i] < HI:
                    break
        adaptive.append((*rates(y[te], (final >= 0.5).astype(int)), roc_auc_score(y[te], final)))
        used.append(n_used.mean())

    def line(name, rows):
        a = np.array(rows)
        m, s = a.mean(0), a.std(0)
        print(f"{name:<34} acc {m[0]:.3f} ±{s[0]:.3f} | sens {m[1]:.3f} | spec {m[2]:.3f} | AUC {m[3]:.3f}")

    print("Forward selection inside each fold, 5-fold x 3 repeats, 174 people\n")
    for k in range(1, MAX_K + 1):
        line(f"{k} task(s): stopwatch rule", res[k]["watch"])
        line(f"{k} task(s): model", res[k]["model"])
    print()
    line(f"Adaptive 3..{MAX_K} tasks (band {LO}-{HI})", adaptive)
    print(f"  average tasks used: {np.mean(used):.2f}")
    print("\nFirst three tasks chosen, by fold:", Counter(tuple(sorted(o[:3])) for o in orders).most_common(6))
    print("How often each task is in the first five:", Counter(t for o in orders for t in o[:5]).most_common(10))


if __name__ == "__main__":
    main()
