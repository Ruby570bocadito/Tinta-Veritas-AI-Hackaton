"""Hard questions about our own model, asked before a judge does.

  1. What is the model really using? Each of its three measures on its own, and in pairs.
  2. Does it survive a device change that is NOT uniform (a finger that slows drawing
     but not pausing, or the other way round)? The uniform case is true by construction.
  3. Does it work equally well for slow and fast writers? (The public data has no age or sex,
     so warm-up speed is the only group we can form.)

Same folds for everything; the three tasks are chosen inside each fold.

Run:  python ml/ablation.py
"""
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import RepeatedStratifiedKFold

from device_shift import HARD, WARMUP, logit, pick, relative, shape

DATA = Path(__file__).resolve().parent.parent / "data" / "darwin" / "data.csv"
NAMES = ["slower than own warm-up", "share of time in the air", "number of touches"]
SUBSETS = {
    "slower than own warm-up, alone": [0],
    "share of time in the air, alone": [1],
    "number of touches, alone": [2],
    "air share + touches (no warm-up needed)": [1, 2],
    "all three": [0, 1, 2],
}


def columns(n_tasks, kinds):
    return [3 * t + k for t in range(n_tasks) for k in kinds]


def reshape(df, tasks, paper=1.0, air=1.0, warm=1.0):
    """A device that changes on-screen time, in-air time or only the warm-ups by different factors."""
    out = df.copy()
    for t in sorted(set(tasks + WARMUP)):
        f_paper, f_air = (paper * warm, air * warm) if t in WARMUP else (paper, air)
        out[f"paper_time{t}"] = df[f"paper_time{t}"] * f_paper
        out[f"air_time{t}"] = df[f"air_time{t}"] * f_air
        out[f"total_time{t}"] = out[f"paper_time{t}"] + out[f"air_time{t}"]
    return out


SHIFTS = {
    "same device": {},
    "everything 1.5x slower (uniform)": dict(paper=1.5, air=1.5),
    "on-screen time 1.5x slower, pauses unchanged": dict(paper=1.5),
    "on-screen time 2x slower, pauses unchanged": dict(paper=2.0),
    "pauses 1.5x longer, on-screen unchanged": dict(air=1.5),
    "pauses 2x longer, on-screen unchanged": dict(air=2.0),
}


def main():
    df = pd.read_csv(DATA)
    y = (df["class"] == "P").astype(int).values
    outer = RepeatedStratifiedKFold(n_splits=5, n_repeats=3, random_state=2)
    abl = {k: [] for k in SUBSETS}
    shift = {k: [] for k in SHIFTS}
    groups = {"slowest third": [], "middle third": [], "fastest third": []}

    for tr, te in outer.split(df, y):
        dtr, dte = df.iloc[tr], df.iloc[te]
        tasks = pick(dtr, y[tr], 3, logit, relative, HARD)
        Xtr, Xte = relative(dtr, tasks), relative(dte, tasks)
        for name, kinds in SUBSETS.items():
            c = columns(3, kinds)
            p = logit().fit(Xtr[:, c], y[tr]).proba(Xte[:, c])
            pred = (p >= 0.5).astype(int)
            abl[name].append(((pred == y[te]).mean(), pred[y[te] == 1].mean(), 1 - pred[y[te] == 0].mean(),
                              roc_auc_score(y[te], p)))
        # The model we ship: two measures per task, tasks chosen for those two measures.
        own = pick(dtr, y[tr], 3, logit, shape, HARD)
        model = logit().fit(shape(dtr, own), y[tr])
        for name, kw in SHIFTS.items():
            pred = (model.proba(shape(reshape(dte, own, **kw), own)) >= 0.5).astype(int)
            shift[name].append(((pred == y[te]).mean(), pred[y[te] == 1].mean(), 1 - pred[y[te] == 0].mean()))
        # Slow and fast writers, by their own warm-up time (thirds taken from the training people).
        pace = lambda d: np.log(d[[f"total_time{t}" for t in WARMUP]].values.astype(float)).mean(1)
        lo, hi = np.quantile(pace(dtr), [1 / 3, 2 / 3])
        pred = (model.proba(shape(dte, own)) >= 0.5).astype(int)
        for name, mask in (("fastest third", pace(dte) <= lo), ("middle third", (pace(dte) > lo) & (pace(dte) <= hi)),
                           ("slowest third", pace(dte) > hi)):
            groups[name].append((mask & (y[te] == 1) & (pred == 0), mask & (y[te] == 1),
                                 mask & (y[te] == 0) & (pred == 1), mask & (y[te] == 0)))

    print("1. What is the model really using? (accuracy on unseen people, 5-fold x 3 repeats)\n")
    for name, vals in abl.items():
        m, s = np.mean(vals, 0), np.std(vals, 0)
        print(f"  {name:<42} acc {m[0]:.3f} ±{s[0]:.3f} | sens {m[1]:.3f} | spec {m[2]:.3f} | AUC {m[3]:.3f}")

    print("\n2. A device that does not slow everything equally (the shipped model: air share + touches)\n")
    for name, vals in shift.items():
        m = np.mean(vals, 0)
        print(f"  {name:<46} acc {m[0]:.3f} | patients caught {m[1]:.3f} | healthy wrongly flagged {1 - m[2]:.3f}")

    print("\n3. Slow and fast writers (by their time on the two practice tasks), shipped model, all test folds\n")
    for name, vals in groups.items():
        missed, patients, alarms, healthy = (int(np.sum([v[i].sum() for v in vals])) for i in range(4))
        print(f"  {name:<14} missed {missed:>3} of {patients:>3} patients ({missed / max(patients, 1):.0%})"
              f" | false alarms {alarms:>3} of {healthy:>3} healthy ({alarms / max(healthy, 1):.0%})")


if __name__ == "__main__":
    main()
