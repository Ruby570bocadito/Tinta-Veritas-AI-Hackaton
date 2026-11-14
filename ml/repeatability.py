"""How much would the answer move if the same person did the check again?

Nobody in the public data did the tasks twice, so this cannot be measured. What we can do is
wobble each person's measures a little, the way a second attempt would differ, and count how
often the answer changes. It is a simulation: it tells us how fragile the answer is, not how
much real people vary.

Wobble: on-screen time and in-air time of every task each change by a random percentage
(typical size 10%, 20% or 30%), and with probability 0.3 the number of touches changes by one.

Run:  python ml/repeatability.py
"""
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import RepeatedStratifiedKFold

from adaptive import HI, LO
from device_shift import HARD, logit, pick, shape

DATA = Path(__file__).resolve().parent.parent / "data" / "darwin" / "data.csv"


def answer(p):
    return np.where(p <= LO, 0, np.where(p >= HI, 2, 1))  # usual / can't tell / worth mentioning


def wobble(df, tasks, size, rng):
    out = df.copy()
    for t in tasks:
        paper = df[f"paper_time{t}"].values * np.exp(rng.normal(0, size, len(df)))
        air = df[f"air_time{t}"].values * np.exp(rng.normal(0, size, len(df)))
        step = rng.choice([-1, 0, 1], size=len(df), p=[0.15, 0.7, 0.15])
        out[f"paper_time{t}"], out[f"air_time{t}"] = paper, air
        out[f"total_time{t}"] = paper + air
        out[f"num_of_pendown{t}"] = np.maximum(1, df[f"num_of_pendown{t}"].values + step)
    return out


def main():
    df = pd.read_csv(DATA)
    y = (df["class"] == "P").astype(int).values
    rng = np.random.default_rng(0)
    sizes = [0.1, 0.2, 0.3]
    moved = {s: [] for s in sizes}
    flipped = {s: [] for s in sizes}
    points = {s: [] for s in sizes}
    for tr, te in RepeatedStratifiedKFold(n_splits=5, n_repeats=3, random_state=5).split(df, y):
        dtr, dte = df.iloc[tr], df.iloc[te]
        tasks = pick(dtr, y[tr], 3, logit, shape, HARD)
        model = logit().fit(shape(dtr, tasks), y[tr])
        base = model.proba(shape(dte, tasks))
        for s in sizes:
            for _ in range(20):
                again = model.proba(shape(wobble(dte, tasks, s, rng), tasks))
                a, b = answer(base), answer(again)
                moved[s].append((a != b).mean())
                flipped[s].append((np.abs(a - b) == 2).mean())  # usual <-> worth mentioning
                points[s].append(np.abs(again - base).mean() * 100)

    print("Short check, simulated second attempt (unseen people, 5-fold x 3 repeats, 20 wobbles each)\n")
    print(f"{'typical wobble':<16}{'score moves by':<18}{'answer changes':<18}{'usual <-> worth mentioning'}")
    for s in sizes:
        print(f"{f'{s:.0%}':<16}{f'{np.mean(points[s]):.0f} points':<18}{f'{np.mean(moved[s]):.0%}':<18}{np.mean(flipped[s]):.1%}")
    print("\nMost changes are into or out of \"I can't tell\". A jump straight from \"usual\" to")
    print("\"worth mentioning\" (or back) is rare. Real people may vary more or less than this.")


if __name__ == "__main__":
    main()
