"""Draw the two charts used in the README from the saved experiment outputs.

Run after device_shift.py and experiments.py:  python ml/figures.py
"""
import json
import re
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "docs"
INK, AIR, SOFT, PAPER = "#1d2433", "#e4572e", "#4d5669", "#fffdf8"

plt.rcParams.update({"font.size": 12, "axes.spines.top": False, "axes.spines.right": False,
                     "axes.edgecolor": SOFT, "text.color": INK, "axes.labelcolor": INK,
                     "xtick.color": SOFT, "ytick.color": SOFT, "figure.facecolor": PAPER,
                     "axes.facecolor": PAPER, "savefig.facecolor": PAPER})


def device_shift():
    data = json.loads((HERE / "results" / "4_device_shift.json").read_text())
    series = {"Stopwatch rule (3 tasks)": ("stopwatch, 3 tasks", AIR),
              "Tinta (3 tasks + 2 warm-ups)": ("relative model, 3 tasks (+2 warm-up)", INK)}
    fig, axes = plt.subplots(1, 2, figsize=(10, 4.2), sharex=True)
    for ax, key, title in ((axes[0], "accuracy", "Accuracy"),
                           (axes[1], "false_alarms", "Healthy people wrongly flagged")):
        for label, (name, colour) in series.items():
            xs = sorted(data[name], key=float)
            ax.plot([float(x) for x in xs], [100 * data[name][x][key] for x in xs],
                    marker="o", color=colour, linewidth=2.5, label=label)
        ax.axvline(1, color=SOFT, linestyle=":", linewidth=1)
        ax.set_title(title, loc="left", fontweight="bold")
        ax.set_ylim(0, 100)
        ax.set_ylabel("%")
    axes[0].legend(frameon=False, loc="lower left")
    fig.suptitle("A stopwatch breaks when the device changes. Tinta compares you with yourself.",
                 x=0.01, ha="left", fontsize=13)
    fig.supxlabel("How much slower the device makes everyone (1 = the study's tablet)", fontsize=12)
    fig.tight_layout()
    fig.savefig(OUT / "device-shift.png", dpi=160)


def few_tasks():
    text = (HERE / "results" / "2_few_tasks_vs_stopwatch.txt").read_text(encoding="utf-8")
    rows = re.findall(r"(\d) task\(s\): (stopwatch rule|model)\s+acc ([\d.]+) ±([\d.]+)", text)
    fig, ax = plt.subplots(figsize=(6.5, 4.2))
    for kind, colour, label in (("stopwatch rule", AIR, "Stopwatch rule"),
                                ("model", INK, "Logistic model on raw times")):
        pts = [(int(k), 100 * float(a), 100 * float(s)) for k, m, a, s in rows if m == kind]
        ax.errorbar([p[0] for p in pts], [p[1] for p in pts], yerr=[p[2] for p in pts],
                    marker="o", color=colour, linewidth=2.5, capsize=3, label=label)
    ax.set_ylim(50, 100)
    ax.set_xlabel("Number of tasks (chosen inside each fold)")
    ax.set_ylabel("Accuracy on unseen people (%)")
    ax.set_title("With few tasks, a trained model does not beat a stopwatch", loc="left", fontweight="bold")
    ax.legend(frameon=False, loc="lower right")
    fig.tight_layout()
    fig.savefig(OUT / "few-tasks.png", dpi=160)


def what_breaks():
    """Where the shipped model holds and where it breaks, from the saved ablation output."""
    text = (HERE / "results" / "8_ablation.txt").read_text(encoding="utf-8")
    block = text.split("2. A device")[1].split("3. Slow")[0]
    rows = re.findall(r"^  (.+?)\s+acc [\d.]+ \| patients caught ([\d.]+) \| healthy wrongly flagged ([\d.]+)", block, re.M)
    labels = [r[0].strip() for r in rows][::-1]
    caught = [100 * float(r[1]) for r in rows][::-1]
    flagged = [100 * float(r[2]) for r in rows][::-1]
    fig, axes = plt.subplots(1, 2, figsize=(10, 3.8), sharey=True)
    for ax, vals, title, colour in ((axes[0], caught, "Patients caught (%)", INK),
                                    (axes[1], flagged, "Healthy wrongly flagged (%)", AIR)):
        ax.barh(labels, vals, color=colour, height=0.6)
        for i, v in enumerate(vals):
            ax.text(v + 1.5, i, f"{v:.0f}", va="center", fontsize=11)
        ax.set_xlim(0, 100)
        ax.set_title(title, loc="left", fontweight="bold")
    fig.suptitle("Overall speed cancels out. A device that changes pauses and strokes differently does not.",
                 x=0.01, ha="left", fontsize=13)
    fig.tight_layout()
    fig.savefig(OUT / "what-breaks.png", dpi=160)


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    device_shift()
    few_tasks()
    what_breaks()
    print("wrote", [p.name for p in OUT.glob("*.png")])
