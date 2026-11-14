"""Train the 3-task phone model and export it for the browser.

- Uses only device-independent measures (times and pen-down counts).
- Holds out 20% of people as a test set that the shipped model never sees.
- Writes web/src/model.json (weights + held-out example profiles + metrics).

Run:  python ml/train_export.py
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "darwin" / "data.csv"
OUT = ROOT / "web" / "src" / "model.json"

TASKS = [9, 15, 23]  # most often chosen inside the folds in feasibility.py
MEASURES = ["air_time", "paper_time", "total_time", "num_of_pendown"]
SEED = 0


def features(df):
    names = [f"{m}{t}" for t in TASKS for m in MEASURES]
    return np.log1p(df[names].values.astype(float)), names


def fit(X, y):
    mu, sd = X.mean(axis=0), X.std(axis=0)
    model = LogisticRegression(C=0.3, max_iter=5000).fit((X - mu) / sd, y)
    return model, mu, sd


def rates(y, pred):
    return dict(
        accuracy=float((pred == y).mean()),
        sensitivity=float(pred[y == 1].mean()),
        specificity=float(1 - pred[y == 0].mean()),
        missed=int(((pred == 0) & (y == 1)).sum()),
        false_alarms=int(((pred == 1) & (y == 0)).sum()),
        n=int(len(y)),
    )


def main():
    df = pd.read_csv(DATA)
    y = (df["class"] == "P").astype(int).values
    X, names = features(df)
    idx = np.arange(len(df))
    tr, te = train_test_split(idx, test_size=0.2, stratify=y, random_state=SEED)

    model, mu, sd = fit(X[tr], y[tr])
    p = model.predict_proba((X[te] - mu) / sd)[:, 1]
    pred = (p >= 0.5).astype(int)

    # Simple rule on the same three tasks: total time only.
    tot = np.log(df[[f"total_time{t}" for t in TASKS]].sum(axis=1).values).reshape(-1, 1)
    base, bmu, bsd = fit(tot[tr], y[tr])
    bp = base.predict_proba((tot[te] - bmu) / bsd)[:, 1]
    bpred = (bp >= 0.5).astype(int)

    metrics = dict(model=rates(y[te], pred) | dict(auc=float(roc_auc_score(y[te], p))),
                   baseline=rates(y[te], bpred) | dict(auc=float(roc_auc_score(y[te], bp))))
    print(json.dumps(metrics, indent=1))

    examples = []
    for i, pi, bi in zip(te, p, bp):
        raw = {t: {m: float(df.iloc[i][f"{m}{t}"]) for m in MEASURES} for t in TASKS}
        examples.append(dict(id=str(df.iloc[i]["ID"]), label="patient" if y[i] else "healthy",
                             p=float(pi), baseline_p=float(bi), measures=raw))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(dict(
        tasks=TASKS, measures=MEASURES, feature_names=names,
        transform="log1p then (x - mean) / std",
        mean=mu.tolist(), std=sd.tolist(),
        coef=model.coef_[0].tolist(), intercept=float(model.intercept_[0]),
        baseline=dict(mean=float(bmu[0]), std=float(bsd[0]),
                      coef=float(base.coef_[0][0]), intercept=float(base.intercept_[0])),
        metrics=metrics, train_n=int(len(tr)), examples=examples,
        note="Times are in the units of the DARWIN CSV (assumed milliseconds; not stated by the source).",
    ), indent=1), encoding="utf-8")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
