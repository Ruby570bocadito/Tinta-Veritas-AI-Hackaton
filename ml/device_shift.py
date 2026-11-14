"""Does the result survive a change of device?

DARWIN was recorded with a pen on a tablet. Tinta runs with a finger on a phone, where
everything may be uniformly faster or slower. A stopwatch threshold learned on the tablet
moves with the device. Measures taken relative to the person's own speed should not.

"Relative" measures per hard task:
  - log(time on this task) minus log(time on the person's own warm-up tasks 2 and 3,
    joining two points with a line): how much the task slows *this* person down
  - share of the task spent with the pen in the air
  - log pen-downs
A uniform speed change cancels out of all three.

We simulate a device that is f times slower/faster for the test people only.

Run:  python ml/device_shift.py
"""
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import RepeatedStratifiedKFold, StratifiedKFold

from experiments import POOL, Stopwatch, stopwatch
from model_search import Sk

DATA = Path(__file__).resolve().parent.parent / "data" / "darwin" / "data.csv"
WARMUP = [2, 3]
HARD = [t for t in POOL if t not in WARMUP]
TIME_COLS = ("air_time", "paper_time", "total_time")


def relative(df, tasks):
    ref = np.log(df[[f"total_time{t}" for t in WARMUP]].values.astype(float)).mean(1)
    cols = []
    for t in tasks:
        total = df[f"total_time{t}"].values.astype(float)
        cols += [np.log(total) - ref,
                 df[f"air_time{t}"].values / np.maximum(total, 1),
                 np.log1p(df[f"num_of_pendown{t}"].values.astype(float))]
    return np.column_stack(cols)


def shape(df, tasks):
    """Where the time goes, not how much of it there is. Two measures per task:
    the share of the task spent with the pen in the air, and the number of pen-downs.
    No warm-up is needed, and a uniform change of speed cancels out of both.
    (ablation.py shows these two carry the signal; "slower than own warm-up" adds almost nothing.)"""
    cols = []
    for t in tasks:
        total = np.maximum(df[f"total_time{t}"].values.astype(float), 1)
        cols += [df[f"air_time{t}"].values / total, np.log1p(df[f"num_of_pendown{t}"].values.astype(float))]
    return np.column_stack(cols)


def slower(df, f):
    out = df.copy()
    for c in out.columns:
        if c.startswith(TIME_COLS):
            out[c] = out[c] * f
    return out


def logit():
    return Sk(lambda: LogisticRegression(C=0.1, max_iter=5000), scale=True)


def forest():
    return Sk(lambda: RandomForestClassifier(500, random_state=0, n_jobs=-1))


def pick(dtr, ytr, k, make, feats, pool):
    """Forward selection of k tasks inside the training fold."""
    cv = StratifiedKFold(n_splits=4, shuffle=True, random_state=0)
    chosen = []
    for _ in range(k):
        def score(t):
            X = feats(dtr, chosen + [t])
            return np.mean([roc_auc_score(ytr[b], make().fit(X[a], ytr[a]).proba(X[b]))
                            for a, b in cv.split(X, ytr)])
        chosen.append(max([t for t in pool if t not in chosen], key=score))
    return chosen


def main():
    df = pd.read_csv(DATA)
    y = (df["class"] == "P").astype(int).values
    outer = RepeatedStratifiedKFold(n_splits=5, n_repeats=3, random_state=2)
    factors = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.25, 1.5, 1.75, 2.0]
    table = [0.5, 0.7, 1.0, 1.5, 2.0]
    rows = {}

    def add(name, f, y_te, p):
        pred = (p >= 0.5).astype(int)
        rows.setdefault((name, f), []).append(((pred == y_te).mean(), pred[y_te == 1].mean(),
                                               1 - pred[y_te == 0].mean(), roc_auc_score(y_te, p)))

    picks = []
    for tr, te in outer.split(df, y):
        dtr = df.iloc[tr]
        sw3 = pick(dtr, y[tr], 3, Stopwatch, stopwatch, POOL)
        rel3 = pick(dtr, y[tr], 3, logit, relative, HARD)
        rel5 = pick(dtr, y[tr], 2, logit, relative, [t for t in HARD if t not in rel3])
        rel5 = rel3 + rel5
        picks.append(tuple(rel5))
        models = {
            "stopwatch, 3 tasks": (stopwatch, sw3, Stopwatch().fit(stopwatch(dtr, sw3), y[tr])),
            "stopwatch, 14 tasks": (stopwatch, HARD, Stopwatch().fit(stopwatch(dtr, HARD), y[tr])),
            "relative model, 3 tasks (+2 warm-up)": (relative, rel3, logit().fit(relative(dtr, rel3), y[tr])),
            "relative model, 5 tasks (+2 warm-up)": (relative, rel5, logit().fit(relative(dtr, rel5), y[tr])),
            "relative model, 14 tasks, logistic": (relative, HARD, logit().fit(relative(dtr, HARD), y[tr])),
            "relative model, 14 tasks, forest": (relative, HARD, forest().fit(relative(dtr, HARD), y[tr])),
        }
        for f in factors:
            dte = slower(df.iloc[te], f)
            for name, (feats, tasks, m) in models.items():
                add(name, f, y[te], m.proba(feats(dte, tasks)))

    names = list(dict.fromkeys(n for n, _ in rows))
    print("Accuracy when the test device is f times slower (f = 1 is the tablet itself)\n")
    print(f"{'':<40}" + "".join(f"  f={f:<4}" for f in table))
    for n in names:
        print(f"{n:<40}" + "".join(f"  {np.mean([r[0] for r in rows[(n, f)]]):.3f} " for f in table))
    import json
    out = Path(__file__).resolve().parent / "results" / "4_device_shift.json"
    out.write_text(json.dumps({n: {str(f): dict(accuracy=float(np.mean([r[0] for r in rows[(n, f)]])),
                                               false_alarms=float(1 - np.mean([r[2] for r in rows[(n, f)]])),
                                               missed=float(1 - np.mean([r[1] for r in rows[(n, f)]])))
                                   for f in factors} for n in names}, indent=1))
    print("\nAt f = 1 (no shift): accuracy ±sd | sensitivity | specificity | AUC")
    for n in names:
        a = np.array(rows[(n, 1.0)])
        m, s = a.mean(0), a.std(0)
        print(f"{n:<40} {m[0]:.3f} ±{s[0]:.3f} | {m[1]:.3f} | {m[2]:.3f} | {m[3]:.3f}")
    print("\nFalse alarms among healthy people (1 - specificity) at f = 1.5 and f = 2.0:")
    for n in names:
        print(f"{n:<40} {1 - np.mean([r[2] for r in rows[(n, 1.5)]]):.3f}   {1 - np.mean([r[2] for r in rows[(n, 2.0)]]):.3f}")
    from collections import Counter
    print("\nTasks picked for the relative model (first 5):", Counter(t for p in picks for t in p).most_common(8))


if __name__ == "__main__":
    main()
