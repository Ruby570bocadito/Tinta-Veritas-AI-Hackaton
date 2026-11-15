"""The one picture behind the whole project: where does the extra time go?

For each scored task, the median time with the pen on the paper and with the pen in the air, for the healthy
group and for the group with Alzheimer's. Writing takes a little longer; the pauses take several times longer.
The demo video opens with these numbers for the backwards word (task 16).

These are medians of groups in the DARWIN study (pen on paper over a tablet), not two people. The tablet also
records the pen while it hovers, so "in the air" includes that: a phone would see less (see own_data.py).

Run:  python ml/in_the_air.py
"""
from pathlib import Path

import pandas as pd

DATA = Path(__file__).resolve().parent.parent / "data" / "darwin" / "data.csv"
TASKS = {16: "a four-letter word, copied backwards", 5: "a circle, four times round", 9: '"le" four times, joined up'}


def main():
    df = pd.read_csv(DATA)
    sick = df["class"] == "P"
    print(f"{int((~sick).sum())} healthy people and {int(sick.sum())} with Alzheimer's. Medians, in seconds.\n")
    print(f"{'task':<44}{'group':<14}{'on paper':>10}{'in the air':>12}{'share in the air':>18}{'pen-downs':>11}")
    for t, name in TASKS.items():
        rows = {}
        for label, who in ((False, "healthy"), (True, "Alzheimer's")):
            g = df[sick == label]
            paper, air = g[f"paper_time{t}"].median() / 1000, g[f"air_time{t}"].median() / 1000
            share = (g[f"air_time{t}"] / g[f"total_time{t}"].clip(lower=1)).median()
            rows[who] = (paper, air)
            print(f"{f'{t}: {name}':<44}{who:<14}{paper:>10.1f}{air:>12.1f}{share:>17.0%} {g[f'num_of_pendown{t}'].median():>10.0f}")
        (p0, a0), (p1, a1) = rows["healthy"], rows["Alzheimer's"]
        print(f"{'':<44}the Alzheimer's group: {p1 / p0:.1f} times as long on paper, {a1 / a0:.1f} times as long in the air\n")
    print("On the word, writing itself takes 1.4 times as long, and the time in the air takes about 4 times as long.")
    print("That is why Tinta reads the pauses and not the speed.")


if __name__ == "__main__":
    main()
