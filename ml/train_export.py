"""Train the model that ships in the app and export it for the browser.

Design (see experiments.py, model_search.py and device_shift.py for why):
  - 2 warm-up tasks measure the person's own writing speed.
  - 3 harder tasks are measured *relative to that speed*, so a slower or faster device cancels out.
  - The 3 tasks are picked by forward selection on the training people only.
  - 20% of people are held out; the shipped model never sees them.

Writes web/src/model.json.   Run:  python ml/train_export.py
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split

from device_shift import HARD, WARMUP, logit, pick, relative, slower
from experiments import POOL, Stopwatch, stopwatch

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "darwin" / "data.csv"
OUT = ROOT / "web" / "src" / "model.json"
SEED = 0
MEASURES = ["air_time", "paper_time", "total_time", "num_of_pendown"]


def rates(y, p):
    pred = (p >= 0.5).astype(int)
    return dict(accuracy=round(float((pred == y).mean()), 3),
                missed=int(((pred == 0) & (y == 1)).sum()), patients=int(y.sum()),
                false_alarms=int(((pred == 1) & (y == 0)).sum()), healthy=int((1 - y).sum()),
                auc=round(float(roc_auc_score(y, p)), 3))


def main():
    df = pd.read_csv(DATA)
    y = (df["class"] == "P").astype(int).values
    tr, te = train_test_split(np.arange(len(df)), test_size=0.2, stratify=y, random_state=SEED)
    dtr, dte = df.iloc[tr], df.iloc[te]

    tasks = pick(dtr, y[tr], 3, logit, relative, HARD)
    model = logit().fit(relative(dtr, tasks), y[tr])
    sw_tasks = pick(dtr, y[tr], 3, Stopwatch, stopwatch, POOL)
    sw = Stopwatch().fit(stopwatch(dtr, sw_tasks), y[tr])
    print("model tasks:", tasks, "| stopwatch tasks:", sw_tasks)

    metrics = {}
    for f in (1.0, 1.5, 2.0):
        d = slower(dte, f)
        metrics[str(f)] = dict(model=rates(y[te], model.proba(relative(d, tasks))),
                               stopwatch=rates(y[te], sw.proba(stopwatch(d, sw_tasks))))
    print(json.dumps(metrics, indent=1))

    p = model.proba(relative(dte, tasks))
    needed = sorted(set(WARMUP + tasks))
    examples = [dict(id=str(dte.iloc[i]["ID"]), label="patient" if y[te][i] else "healthy", p=round(float(p[i]), 4),
                     measures={str(t): {m: float(dte.iloc[i][f"{m}{t}"]) for m in MEASURES} for t in needed})
                for i in range(len(te))]

    lr = model.m
    OUT.write_text(json.dumps(dict(
        warmup=WARMUP, tasks=tasks,
        features="per task: [log(total) - mean log(total of warm-ups), air/total, log1p(pen-downs)]",
        mean=np.asarray(model.mu).tolist(), std=np.asarray(model.sd).tolist(),
        coef=lr.coef_[0].tolist(), intercept=float(lr.intercept_[0]),
        stopwatch=dict(tasks=sw_tasks, mean=sw.mu.tolist(), std=sw.sd.tolist(),
                       coef=float(sw.m.coef_[0][0]), intercept=float(sw.m.intercept_[0])),
        metrics=metrics, train_n=int(len(tr)), test_n=int(len(te)), examples=examples,
        note="DARWIN times are assumed to be milliseconds (the source does not state units).",
    ), indent=1), encoding="utf-8")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
