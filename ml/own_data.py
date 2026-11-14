"""Our own data: healthy volunteers doing the check with a finger on a real phone.

Each line of data/own/volunteers.jsonl is what the app shows in study mode (?study):
only timings and an age band. No name, no drawing. Everyone was asked first.

Questions:
  1. How many healthy people does Tinta wrongly flag on a real phone? And a stopwatch rule?
  2. How different is a finger on a phone from a pen on the study's tablet?
     (Until now we only simulated this as "everything uniformly slower".)

Run:  python ml/own_data.py
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

from device_shift import WARMUP, logit, relative
from experiments import Stopwatch, stopwatch

ROOT = Path(__file__).resolve().parent.parent
DARWIN = ROOT / "data" / "darwin" / "data.csv"
OWN = ROOT / "data" / "own" / "volunteers.jsonl"
MODEL = ROOT / "web" / "src" / "model.json"
MEASURES = ["air_time", "paper_time", "total_time", "num_of_pendown"]


def load_own():
    rows = []
    for line in OWN.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        rec = json.loads(line)
        row = {"age": rec.get("age", ""), "app_score": rec.get("score")}
        for task, m in rec["tasks"].items():
            for name in MEASURES:
                row[f"{name}{task}"] = m[name]
        rows.append(row)
    return pd.DataFrame(rows)


def main():
    model = json.loads(MODEL.read_text(encoding="utf-8"))
    tasks, (lo, hi) = model["tasks"], model["grey"]
    darwin = pd.read_csv(DARWIN)
    y = (darwin["class"] == "P").astype(int).values
    own = load_own()
    if len(own):
        own = own[(own[[f"total_time{t}" for t in WARMUP + tasks]] > 0).all(axis=1)]  # finished the short check
    n = len(own)
    if n == 0:
        print("No volunteers yet. Paste the study-mode lines into", OWN)
        return
    print(f"{n} healthy volunteers on a phone; age bands: {own['age'].value_counts().to_dict()}\n")

    # 1. Tinta's short check, exactly as shipped (same weights as the app).
    z = (relative(own, tasks) - np.array(model["mean"])) / np.array(model["std"])
    p = 1 / (1 + np.exp(-(z @ np.array(model["coef"]) + model["intercept"])))
    flagged, unsure = int((p >= hi).sum()), int(((p > lo) & (p < hi)).sum())
    print("Tinta (short check, the shipped model)")
    print(f"  wrongly flagged 'worth mentioning': {flagged} of {n}")
    print(f"  'I can't tell': {unsure} of {n}")
    print(f"  'usual pattern': {n - flagged - unsure} of {n}")
    print(f"  scores: {np.round(100 * np.sort(p)).astype(int).tolist()}\n")

    # 2. A stopwatch rule learned on the tablet, on the very same three tasks (so the comparison is fair).
    sw = Stopwatch().fit(stopwatch(darwin, tasks), y)
    ps = sw.proba(stopwatch(own, tasks))
    print("Stopwatch rule learned on the study's tablet, same three tasks")
    print(f"  wrongly flagged (score 50 or more): {int((ps >= 0.5).sum())} of {n}")
    print(f"  Tinta with the same 50 cut-off:     {int((p >= 0.5).sum())} of {n}\n")

    # 3. Finger on a phone against pen on the tablet: is it "everything uniformly slower"?
    healthy = darwin[y == 0]
    print("Median time per task: healthy people in the study (pen, tablet) vs our volunteers (finger, phone)")
    ratios = []
    for t in WARMUP + tasks:
        a, b = healthy[f"total_time{t}"].median(), own[f"total_time{t}"].median()
        ratios.append(b / a)
        print(f"  task {t:>2}: {a / 1000:5.1f} s  vs {b / 1000:5.1f} s   phone / tablet = x{b / a:.2f}")
    print(f"  the factor ranges from x{min(ratios):.2f} to x{max(ratios):.2f}.",
          "If it were one number for every task, our simulation would be exact; the spread is what it misses.\n")

    by_age = own.assign(p=p).groupby("age")["p"].agg(["count", "median", "max"]).round(2)
    print("Tinta's score by age band (healthy volunteers):")
    print(by_age.to_string())
    print("\nWith so few people these are counts, not rates. They show whether the idea survives a real phone;",
          "they cannot say how it does with patients.")


if __name__ == "__main__":
    main()
