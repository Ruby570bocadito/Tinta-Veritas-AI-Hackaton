"""Our own data: healthy volunteers doing the check with a finger on a real phone.

Each line of data/own/volunteers.jsonl is what the app shows in study mode (?study):
only timings and an age band. No name, no drawing. Everyone was asked first.
The same line is what invited testers send with ?friends.

Questions:
  1. How many healthy people does Tinta wrongly flag on a real phone? And a stopwatch rule?
  2. How different is a finger on a phone from a pen on the study's tablet?
     (Until now we only simulated this as "everything uniformly slower".)
  3. Do the two measures the model uses (share of time in the air, number of touches) look the same?
  4. What can a pen tablet see that a phone cannot? (The pen hovering.)
  5. When the app says a task cannot be compared and asks for it again, what do people do?

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
TOLD = {"typical": "usual pattern", "unsure": "I can't tell", "mention": "worth mentioning"}


def load_own():
    """One row per line of the file. Volunteers are numbered in the order of the file; a second try by the
    same person ("again_of") keeps its own row but is not another volunteer."""
    rows, number = [], 0
    for line in OWN.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        rec = json.loads(line)
        again = rec.get("again_of")
        if not again:
            number += 1
        row = {"number": again or number, "again": bool(again), "age": rec.get("age", ""), "app_score": rec.get("score"),
               "verdict": rec.get("verdict", ""), "closer": bool(rec.get("closer")), "width": (rec.get("screen") or [np.nan])[0],
               # Saved only by the version of the app that checks the tasks: laps of the circle, how many "le", turns in the word,
               # where Tinta said a task could not be compared ("warned"), tasks done again ("tries"), tasks left with no result.
               "checked": "laps" in rec, "laps": rec.get("laps", np.nan), "les": rec.get("les", np.nan), "turns": rec.get("turns", np.nan),
               "warned": rec.get("warned"), "tries": rec.get("tries", {}), "no_result": rec.get("noResult", []),
               "still": sum(rec.get("still", {}).values()) if "still" in rec else np.nan,
               # "v" (when that copy of the app was built) is in the lines sent from 15 Nov on. Lines without it measured
               # a resting finger the old way.
               "build": rec.get("v"),
               # From 14 Nov 21:00 the app joins breaks under 150 ms into one stroke (a finger skipping on glass).
               "skips_joined": bool(rec.get("skips_joined") or rec.get("v"))}
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
    everyone = load_own()
    if len(everyone):
        everyone = everyone[(everyone[[f"total_time{t}" for t in WARMUP + tasks]] > 0).all(axis=1)]  # finished the short check
    own = everyone[~everyone["again"]].reset_index(drop=True) if len(everyone) else everyone
    n = len(own)
    if n == 0:
        print("No volunteers yet. Paste the study-mode lines into", OWN)
        return
    print(f"{n} healthy volunteers on a phone; age bands: {own['age'].value_counts().to_dict()}\n")

    # 1. Tinta's short check, exactly as shipped (same weights as the app), on everyone's timings.
    def short(frame):
        z = (shape(frame, tasks) - np.array(model["mean"])) / np.array(model["std"])
        return 1 / (1 + np.exp(-(z @ np.array(model["coef"]) + model["intercept"])))

    p = short(own)
    flagged, unsure = int((p >= hi).sum()), int(((p > lo) & (p < hi)).sum())
    print("Tinta's model alone (short check, the shipped weights), on everyone's timings")
    print(f"  'worth mentioning': {flagged} of {n}")
    print(f"  'I can't tell': {unsure} of {n}")
    print(f"  'usual pattern': {n - flagged - unsure} of {n}")
    print(f"  numbers: {np.round(100 * np.sort(p)).astype(int).tolist()}\n")

    # What the app itself told each person: after the closer look when the short check was unsure, and with no
    # result at all when a scored task could not be compared with the study.
    none = own["no_result"].map(len) > 0
    told = own["verdict"].map(TOLD).where(~none, "no result")
    print("What the app told them")
    print(f"  no result (a scored task could not be compared with the study): {int(none.sum())} of {n}")
    print(f"  needed the closer look: {int(own['closer'].sum())} of {n}")
    print(f"  answers: {told.value_counts().to_dict()}")
    print(f"  wrongly told 'worth mentioning': {int((told == 'worth mentioning').sum())} of {n}")
    print(f"  numbers shown: {sorted(int(v) for v in own.loc[~none, 'app_score'])}\n")

    # 2. A stopwatch rule learned on the tablet, on the very same three tasks (so the comparison is fair).
    sw = Stopwatch().fit(stopwatch(darwin, tasks), y)
    ps = sw.proba(stopwatch(own, tasks))
    print("Stopwatch rule learned on the study's tablet, same three tasks")
    print(f"  wrongly flagged (score 50 or more): {int((ps >= 0.5).sum())} of {n}")
    print(f"  Tinta's model with the same 50 cut-off: {int((p >= 0.5).sum())} of {n}\n")

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
    low = float(np.round(100 * short(pd.DataFrame([{f"{m}{t}": v for t in tasks for m, v in (("air_time", 0), ("total_time", 1000), ("num_of_pendown", 1))}]))[0]))
    print(f"  A person who never lifts gets {low:.0f}/100 from the model, the lowest number it can give for one touch per task.\n")

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
    # The closer look these volunteers did was its first version (three letters and two phone numbers). The phone
    # numbers are no longer in the app, so only the tasks that are still there can be held against today's lines.
    looked = own[own["closer"]]
    still = [t for t in model["extra_tasks"] if t in floor and f"air_time{t}" in looked.columns and looked[f"air_time{t}"].notna().any()]
    under = int(sum(((100 * looked[f"air_time{t}"] / looked[f"total_time{t}"].clip(lower=1)) < 100 * floor[t]).any() for t in still)) if len(looked) else 0
    print(f"  the {len(looked)} who did the closer look did its first version (letters and two phone numbers). Of its tasks that are still in the app,")
    print(f"  under their line: {under} of {len(still)} ({', '.join(f'task {t}: {100 * floor[t]:.1f}%' for t in still)})")
    early = below & ~own["checked"]
    print(f"  {int(early.sum())} of those {int(below.sum())} used the app before it checked the tasks: they were told 'usual pattern' with its lowest numbers.")
    print(f"  The other {int((below & own['checked']).sum())} were told there was no result (next section).")
    old = int((~own["skips_joined"]).sum())
    print(f"  {old} of the {n} were recorded before the app joined breaks under 150 ms into one stroke (a finger skipping on glass),")
    print("  so their touches may include skips. Only totals were saved, so that cannot be redone.\n")

    # 6. The checks of the tasks on real fingers. Their limits were set with drawings made by a formula
    # (a task counts from 2.5 of its 4 repetitions; a word needs 10 turns), so every real person matters here.
    after = own[own["checked"]]
    names = {2: "practice line", 3: "practice line", 5: "circle", 9: "loops", 16: "word"}
    print(f"Recorded with the version that checks the tasks: {len(after)} volunteer{'s' if len(after) != 1 else ''}")
    asked, redone, kept = {}, {}, {}
    for _, r in after.iterrows():
        warned = r["warned"] if isinstance(r["warned"], dict) else {}
        tries = {int(k): v for k, v in r["tries"].items()}
        left = {int(str(x).split(":")[0]) for x in r["no_result"]}
        for task in (int(k) for k in warned):
            asked[task] = asked.get(task, 0) + 1
            if tries.get(task):
                redone[task] = redone.get(task, 0) + 1
            if task in left:
                kept[task] = kept.get(task, 0) + 1
        said = "no result" if left else f"{TOLD[r['verdict']]} ({int(r['app_score'])}/100)"
        about = ", ".join(f"{names.get(int(k), k)} ({v})" for k, v in warned.items()) or ("nothing" if isinstance(r["warned"], dict) else "not recorded")
        again = ", ".join(f"{names.get(k, k)} x{v}" for k, v in tries.items()) or "nothing"
        print(f"  volunteer {int(r['number']):>2}: laps {r['laps']:.1f} | 'le' {r['les']:.1f} | turns in the word {int(r['turns'])} | Tinta asked about: {about} | done again: {again} | told: {said}")
    print("  (asked 4 laps and 4 'le', counted from 2.5; a word counts from 10 turns)")
    for task in sorted(asked):
        people = f"{asked[task]} {'person' if asked[task] == 1 else 'people'}"
        if task in WARMUP:   # practice is not scored: leaving it wrong costs nothing, so only the second tries are known
            print(f"  {names.get(task, task)}: Tinta asked {people} to do it again; {redone.get(task, 0)} tried again")
        else:
            print(f"  {names.get(task, task)}: Tinta asked {people} to do it again; {redone.get(task, 0)} tried again; "
                  f"{asked[task] - kept.get(task, 0)} ended with the task done, {kept.get(task, 0)} left with no result")
    stopped = asked.get(word, 0)
    if stopped:
        tried, done = redone.get(word, 0), stopped - kept.get(word, 0)
        print(f"  The word written without lifting the finger: {stopped} of {len(after)} people. Asked to write it again letter by letter,")
        print(f"  {tried} of {stopped} tried, and {done} of {stopped} ended up lifting the finger. So the check that protects the result also left")
        print(f"  {kept.get(word, 0)} of {len(after)} people without one.")
        print("  The four tasks before the word all say 'without lifting your finger', and people carried on that way.")
        print("  After seeing this, the app asks for the word letter by letter from the start, and writing it again is the main button.")
    old = everyone.loc[everyone["checked"] & everyone["build"].isna(), "still"]
    new = everyone.loc[everyone["checked"] & everyone["build"].notna(), "still"]
    print(f"  A finger resting on the glass for a quarter of a second or more during a scored task: {int((old > 0).sum())} of {len(old)} runs.")
    print("  That was measured as a quarter of a second with no touch event at all. A finger that rests still trembles and the phone")
    print("  keeps sending tiny moves, so these zeros may only mean that the measure was blind. The app now counts a rest when the")
    print(f"  finger stays within 3 pixels for that long. Runs recorded that way so far: {len(new)}"
          + (f", with a rest in {int((new > 0).sum())} of them (median {new.median():.0f} ms)." if len(new) else "."))
    print("  The limits of the checks (2.5 laps, 2.5 'le', 10 turns) were set with drawings made by a formula; these few people are all the calibration there is.\n")

    # 7. The same person twice.
    twice = everyone[everyone["again"]]
    if len(twice):
        print("The same person, a second time (not counted as another volunteer)")
        for _, r in twice.iterrows():
            first = own[own["number"] == r["number"]].iloc[0]
            def word_of(x):
                return f"{100 * x[f'air_time{word}'] / max(x[f'total_time{word}'], 1):.0f}% of the word in the air, {int(x[f'num_of_pendown{word}'])} touches"
            gap = abs(int(r['app_score']) - int(first['app_score']))
            same = "the same answer" if r["verdict"] == first["verdict"] else "a different answer"
            print(f"  volunteer {int(r['number'])}: {int(first['app_score'])}/100 on a phone ({word_of(first)}), then {int(r['app_score'])}/100 on a screen {int(r['width'])} px wide ({word_of(r)}).")
            print(f"  {same} both times ('{TOLD[r['verdict']]}'), {gap} points apart. One person, and the screen changed too: an anecdote about how much the number moves between tries.")
        print()

    by_age = own.assign(p=p).groupby("age")["p"].agg(["count", "median", "max"]).round(2)
    print("The model's number by age band (healthy volunteers):")
    print(by_age.to_string())
    print("\nWith so few people these are counts, not rates. They show whether the idea survives a real phone;",
          "they cannot say how it does with patients. Nobody over 59 and no patient is in this file.")


if __name__ == "__main__":
    main()
