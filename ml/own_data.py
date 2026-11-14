"""Our own data: healthy volunteers doing the check with a finger on a real phone.

Each line of data/own/volunteers.jsonl is what the app shows in study mode (?study):
only timings and an age band. No name, no drawing. Everyone was asked first.
The same line is what invited testers send with ?friends.

Questions:
  1. How many healthy people does Tinta wrongly flag on a real phone? And a stopwatch rule?
  2. How different is a finger on a phone from a pen on the study's tablet?
     (Until now we only simulated this as "everything uniformly slower".)
  3. Do the two measures the model uses (share of time in the air, number of touches) look the same?
  4. What can a pen tablet see that a phone cannot? (The pen hovering: see the last section.)

Run:  python ml/own_data.py
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

from device_shift import WARMUP, shape
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
        row = {"age": rec.get("age", ""), "app_score": rec.get("score"), "verdict": rec.get("verdict", ""), "closer": bool(rec.get("closer")),
               # Saved only by the version of the app that checks the tasks: laps of the circle, how many "le", turns in the word.
               "laps": rec.get("laps", np.nan), "les": rec.get("les", np.nan), "turns": rec.get("turns", np.nan),
               "no_result": len(rec.get("noResult", [])), "repeats": sum(rec.get("tries", {}).values())}
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
    z = (shape(own, tasks) - np.array(model["mean"])) / np.array(model["std"])
    p = 1 / (1 + np.exp(-(z @ np.array(model["coef"]) + model["intercept"])))
    flagged, unsure = int((p >= hi).sum()), int(((p > lo) & (p < hi)).sum())
    print("Tinta (short check, the shipped model)")
    print(f"  wrongly flagged 'worth mentioning': {flagged} of {n}")
    print(f"  'I can't tell': {unsure} of {n}")
    print(f"  'usual pattern': {n - flagged - unsure} of {n}")
    print(f"  scores: {np.round(100 * np.sort(p)).astype(int).tolist()}\n")

    # What the app itself told each person, after the closer look when the short check was unsure.
    print("What the app told them (short check, plus the closer look when it was unsure)")
    print(f"  needed the closer look: {int(own['closer'].sum())} of {n}")
    print(f"  final answers: {own['verdict'].value_counts().to_dict()}; final scores: {sorted(int(v) for v in own['app_score'])}\n")

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

    # 4. The two measures the model reads. This is the part our simulation held fixed.
    print("The model's two measures, per scored task: healthy people in the study (pen) vs our volunteers (finger)")
    print("            share of time in the air (median)      touches (median)      did it in a single touch")
    for t in tasks:
        da = (healthy[f"air_time{t}"] / healthy[f"total_time{t}"].clip(lower=1))
        oa = (own[f"air_time{t}"] / own[f"total_time{t}"].clip(lower=1))
        dn, on = healthy[f"num_of_pendown{t}"], own[f"num_of_pendown{t}"]
        print(f"  task {t:>2}:   study {100 * da.median():3.0f}%   ours {100 * oa.median():3.0f}%          "
              f"study {dn.median():4.1f}   ours {on.median():4.1f}        "
              f"study {int((dn <= 1).sum()):>2} of {len(dn)}   ours {int((on <= 1).sum())} of {n}")
    never = int((own[[f"air_time{t}" for t in tasks]].sum(axis=1) == 0).sum())
    print(f"  {never} of {n} volunteers never lifted the finger during the three scored tasks.")
    low = float(np.round(100 * (1 / (1 + np.exp(-((shape(pd.DataFrame([{f'{m}{t}': v for t in tasks for m, v in (('air_time', 0), ('total_time', 1000), ('num_of_pendown', 1))}]), tasks) - np.array(model['mean'])) / np.array(model['std'])) @ np.array(model['coef']) - model['intercept'])))[0]))
    print(f"  A person who never lifts gets {low:.0f}/100, the lowest score the model can give for one touch per task.\n")

    # 5. What a phone cannot see. A pen tablet also records the pen while it hovers over the paper, before the
    # first stroke and after the last one. A phone only knows about a finger while it touches. So in the study
    # "time in the air" is never zero, even for people who wrote a task in a single stroke.
    print("What a phone cannot see: time in the air of people in the study who did a task in ONE stroke (all of it is the pen hovering)")
    for t in tasks:
        one = darwin[darwin[f"num_of_pendown{t}"] <= 1]
        share = one[f"air_time{t}"] / one[f"total_time{t}"].clip(lower=1)
        zero = int((darwin[f"air_time{t}"] == 0).sum())
        ours = int(((own[f"num_of_pendown{t}"] <= 1) & (own[f"air_time{t}"] == 0)).sum())
        print(f"  task {t:>2}: {len(one):>3} of {len(darwin)} people in the study did it in one stroke; their median share of time in the air was "
              f"{100 * share.median():2.0f}%. With exactly zero time in the air: study {zero} of {len(darwin)}, our volunteers {ours} of {n}")
    print("  Zero time in the air never happens in the study and is common on a phone: for the model it is a value it never saw.\n")

    # 5b. The rule the app has today: a word or a number with less time in the air than anyone in the study had on
    # that task gets no result (the limits are exported by train_export.py as air_floor). Who would it stop?
    floor = {int(t): v for t, v in model["air_floor"].items()}
    word = tasks[0]
    share = 100 * own[f"air_time{word}"] / own[f"total_time{word}"].clip(lower=1)
    below = share < 100 * floor[word]
    print("Today's rule: no result when a word or a number has less time in the air than anyone in the study had on that task")
    print(f"  the backwards word: the study's lowest is {100 * floor[word]:.1f}%. Our volunteers: {', '.join(f'{v:.0f}%' for v in sorted(share))}")
    print(f"  under that line: {int(below.sum())} of {n}, all of them with the word written in a single drag" if (own.loc[below, f"num_of_pendown{word}"] <= 1).all()
          else f"  under that line: {int(below.sum())} of {n}")
    print(f"  the closest one above it: {share[~below].min():.1f}%. A line this sharp is a choice: a little less pause and that person would get no result.")
    looked = own[own["closer"]]
    extra = [t for t in model["extra_tasks"] if t in floor]
    under = int(sum(((100 * looked[f"air_time{t}"] / looked[f"total_time{t}"].clip(lower=1)) < 100 * floor[t]).any() for t in extra)) if len(looked) else 0
    print(f"  the {len(looked)} who did the closer look: tasks under their line, {under} of {len(extra)} (lines: {', '.join(f'task {t} {100 * floor[t]:.1f}%' for t in extra)})")
    told = own.loc[below, "verdict"].value_counts().to_dict()
    print(f"  What those {int(below.sum())} were told by the app of that moment: {told}, with its lowest scores. Today they would get no result,")
    print("  and Tinta would ask for the word again, letter by letter.")
    print("  All of these timings were recorded before the app joined breaks under 150 ms into one stroke (a finger skipping on")
    print("  glass), so the touches above may include skips. Only totals were saved, so that cannot be redone.\n")

    # 6. The checks of the tasks on real fingers. Their limits were set with drawings made by a formula
    # (a task counts from 2.5 of its 4 repetitions; a word needs 10 turns), so every real person matters here.
    after = own[own["laps"].notna()]
    print(f"Recorded with the version that checks the tasks: {len(after)} volunteer{'s' if len(after) != 1 else ''}")
    for _, r in after.iterrows():
        print(f"  laps of the circle {r['laps']:.1f} (asked 4, counts from 2.5) | 'le' {r['les']:.1f} (asked 4, counts from 2.5) | turns in the word {int(r['turns'])} (counts from 10)"
              f" | tasks repeated {int(r['repeats'])} | tasks with no result {int(r['no_result'])} | told: {r['verdict']} ({int(r['app_score'])}/100)")
    print("  One person is an anecdote, not a calibration.\n" if len(after) < 5 else "")

    by_age = own.assign(p=p).groupby("age")["p"].agg(["count", "median", "max"]).round(2)
    print("Tinta's score by age band (healthy volunteers):")
    print(by_age.to_string())
    print("\nWith so few people these are counts, not rates. They show whether the idea survives a real phone;",
          "they cannot say how it does with patients.")


if __name__ == "__main__":
    main()
