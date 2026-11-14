"""Train the models that ship in the app and export them for the browser.

Design (see experiments.py, model_search.py, device_shift.py, deep_search.py and adaptive.py for why):
  - 2 practice tasks come first so the person gets used to the screen. They are not scored.
  - Stage 1: 3 tasks, two measures each (share of time in the air, number of touches), logistic regression.
    These two measures do not depend on how fast the person or the device is (see ablation.py).
  - Stage 2, only when stage 1 is unsure: 3 more tasks and a blend of three models on all 6
    (logistic regression, RBF support vector machine, random forest).
  - Tasks and settings are chosen with the training people only; 20% of people are held out.

Writes web/src/model.json.   Run:  python ml/train_export.py
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import StratifiedKFold, train_test_split

from adaptive import HI, LO, SPLIT, blend, disagreement, stage2, told
from ablation import reshape
from device_shift import HARD, WARMUP, logit, pick, shape, slower
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


def more_tasks(d, y, chosen, k):
    """Continue the forward selection from the tasks already fixed."""
    cv = StratifiedKFold(n_splits=4, shuffle=True, random_state=0)
    chosen = list(chosen)
    for _ in range(k):
        def score(t):
            X = shape(d, chosen + [t])
            return np.mean([roc_auc_score(y[b], logit().fit(X[a], y[a]).proba(X[b])) for a, b in cv.split(X, y)])
        chosen.append(max([t for t in HARD if t not in chosen], key=score))
    return chosen


def export_blend(members):
    """Plain numbers the browser can use, and a pure-numpy copy of the maths to check them."""
    lr, svm, rf = (m.best_estimator_ for m in members)
    platt = members[1]
    out = {}
    s, m = lr[0], lr[1]
    out["logistic"] = dict(mean=s.mean_.tolist(), std=s.scale_.tolist(), coef=m.coef_[0].tolist(),
                           intercept=float(m.intercept_[0]))
    s, m = svm[0], svm[1]
    out["svm"] = dict(mean=s.mean_.tolist(), std=s.scale_.tolist(), gamma=float(m._gamma),
                      vectors=np.round(m.support_vectors_, 5).tolist(), weights=np.round(m.dual_coef_[0], 6).tolist(),
                      intercept=float(m.intercept_[0]), a=platt.a, b=platt.b)
    s, m = rf[0], rf[1]
    trees = []
    for est in m.estimators_:
        t = est.tree_
        leaf = t.value[:, 0, 1] / t.value[:, 0, :].sum(axis=1)
        trees.append(dict(f=t.feature.tolist(), t=np.round(t.threshold, 5).tolist(), l=t.children_left.tolist(),
                          r=t.children_right.tolist(), p=np.round(leaf, 4).tolist()))
    out["forest"] = dict(mean=s.mean_.tolist(), std=s.scale_.tolist(), trees=trees)
    return out


def blend_from_export(e, X):
    """The same arithmetic the browser does, used here to prove the export is faithful."""
    z = (X - e["logistic"]["mean"]) / e["logistic"]["std"]
    p_lr = 1 / (1 + np.exp(-(z @ np.array(e["logistic"]["coef"]) + e["logistic"]["intercept"])))
    v = e["svm"]
    z = (X - v["mean"]) / v["std"]
    k = np.exp(-v["gamma"] * ((z[:, None, :] - np.array(v["vectors"])[None]) ** 2).sum(-1))
    dec = k @ np.array(v["weights"]) + v["intercept"]
    p_svm = 1 / (1 + np.exp(-(v["a"] * dec + v["b"])))
    f = e["forest"]
    z = (X - f["mean"]) / f["std"]
    p_rf = np.zeros(len(X))
    for t in f["trees"]:
        for i, row in enumerate(z):
            n = 0
            while t["l"][n] != -1:
                n = t["l"][n] if row[t["f"][n]] <= t["t"][n] else t["r"][n]
            p_rf[i] += t["p"][n]
    p_rf /= len(f["trees"])
    return (p_lr + p_svm + p_rf) / 3


def main():
    df = pd.read_csv(DATA)
    y = (df["class"] == "P").astype(int).values
    tr, te = train_test_split(np.arange(len(df)), test_size=0.2, stratify=y, random_state=SEED)
    dtr, dte = df.iloc[tr], df.iloc[te]

    tasks = pick(dtr, y[tr], 3, logit, shape, HARD)
    model = logit().fit(shape(dtr, tasks), y[tr])
    sw_tasks = pick(dtr, y[tr], 3, Stopwatch, stopwatch, POOL)
    sw = Stopwatch().fit(stopwatch(dtr, sw_tasks), y[tr])
    all_tasks = more_tasks(dtr, y[tr], tasks, 3)
    members = [m.fit(shape(dtr, all_tasks), y[tr]) for m in stage2()]
    print("stage 1 tasks:", tasks, "| stage 2 adds:", all_tasks[3:], "| stopwatch tasks:", sw_tasks)
    print("chosen settings:", [m.best_params_ for m in members])

    export = export_blend(members)
    X2 = shape(dte, all_tasks)
    p1 = model.proba(shape(dte, tasks))
    p2 = blend(members, X2)
    gap = float(np.abs(blend_from_export(export, X2) - p2).max())
    print(f"largest difference between sklearn and the exported maths: {gap:.5f}")
    assert gap < 0.005, "the exported blend does not reproduce sklearn"

    grey = (p1 > LO) & (p1 < HI)
    final = np.where(grey, p2, p1)
    metrics = {}
    for f in (1.0, 1.5, 2.0):
        d = slower(dte, f)
        metrics[str(f)] = dict(model=rates(y[te], model.proba(shape(d, tasks))),
                               stopwatch=rates(y[te], sw.proba(stopwatch(d, sw_tasks))))
    # A device that does not slow everything equally: this is where the model can break.
    metrics["screen2"] = rates(y[te], model.proba(shape(reshape(dte, tasks, paper=2.0), tasks)))
    metrics["pauses2"] = rates(y[te], model.proba(shape(reshape(dte, tasks, air=2.0), tasks)))
    metrics["adaptive"] = rates(y[te], final) | dict(
        closer_look=int(grey.sum()),
        still_unsure=int((((final > LO) & (final < HI)) | (grey & (disagreement(members, X2) > SPLIT))).sum()))
    metrics["long"] = rates(y[te], p2)
    # What the 35 held-out people are actually told by the app (three answers, not a 50/50 cut).
    unsure = ((final > LO) & (final < HI)) | (grey & (disagreement(members, X2) > SPLIT))
    said = told(final, unsure)
    said_short = told(p1, grey)
    metrics["told"] = {who: dict(zip(("usual", "unsure", "mention"), np.bincount(said[y[te] == label], minlength=3).tolist()))
                       for label, who in ((1, "patients"), (0, "healthy"))}
    metrics["told_short"] = {who: dict(zip(("usual", "unsure", "mention"), np.bincount(said_short[y[te] == label], minlength=3).tolist()))
                             for label, who in ((1, "patients"), (0, "healthy"))}
    print("told (adaptive):", metrics["told"], "| short:", metrics["told_short"])
    print(json.dumps({k: metrics[k] for k in ("1.0", "adaptive", "long")}, indent=1))

    # "You among the 174": the short-check score of every person in the study, each one given by a model
    # trained on the other four fifths (the three tasks stay fixed). The app draws them as dots.
    Xall = shape(df, tasks)
    crowd_p = np.zeros(len(df))
    for a, b in StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED).split(Xall, y):
        crowd_p[b] = logit().fit(Xall[a], y[a]).proba(Xall[b])
    crowd = {who: sorted(int(round(100 * v)) for v in crowd_p[y == label]) for label, who in ((0, "healthy"), (1, "patients"))}
    print("crowd: healthy under 35:", sum(v < 35 for v in crowd["healthy"]), "of", len(crowd["healthy"]),
          "| patients over 65:", sum(v > 65 for v in crowd["patients"]), "of", len(crowd["patients"]))

    # The lowest share of time in the air that anyone in the study had, on the tasks where lifting comes naturally
    # (words and numbers; the circle and the loops are asked "in one go"). A pen tablet also sees the pen hovering,
    # so nobody is near zero. On a phone a lower value means a word written in one drag, or nearly: a value the
    # model never saw, and the app gives no result instead of its lowest score.
    one_go = {5, 9}
    air_floor = {str(t): float(np.floor(1000 * (df[f"air_time{t}"] / df[f"total_time{t}"].clip(lower=1)).min()) / 1000)
                 for t in all_tasks if t not in one_go}
    print("lowest share of time in the air in the study, by task:", air_floor)

    needed = sorted(set(WARMUP + all_tasks))
    examples = [dict(id=str(dte.iloc[i]["ID"]), label="patient" if y[te][i] else "healthy",
                     p1=round(float(p1[i]), 4), p2=round(float(p2[i]), 4), p=round(float(final[i]), 4),
                     told=("usual", "unsure", "mention")[int(said[i])],
                     measures={str(t): {m: float(dte.iloc[i][f"{m}{t}"]) for m in MEASURES} for t in needed})
                for i in range(len(te))]

    lr = model.m
    OUT.write_text(json.dumps(dict(
        warmup=WARMUP, tasks=tasks, extra_tasks=all_tasks[3:], grey=[LO, HI], split=SPLIT,
        features="per task: [air/total, log1p(pen-downs)]",
        mean=np.asarray(model.mu).tolist(), std=np.asarray(model.sd).tolist(),
        coef=lr.coef_[0].tolist(), intercept=float(lr.intercept_[0]),
        blend=export,
        stopwatch=dict(tasks=sw_tasks, mean=sw.mu.tolist(), std=sw.sd.tolist(),
                       coef=float(sw.m.coef_[0][0]), intercept=float(sw.m.intercept_[0])),
        metrics=metrics, crowd=crowd, air_floor=air_floor, train_n=int(len(tr)), test_n=int(len(te)), examples=examples,
        # Typical values in the healthy training people, used to explain a result in plain words.
        healthy_air=float(np.median(shape(dtr[y[tr] == 0], tasks)[:, 0::2])),
        healthy_touches=float(np.median(np.expm1(shape(dtr[y[tr] == 0], tasks)[:, 1::2]))),
        note="DARWIN times are assumed to be milliseconds (the source does not state units).",
    )), encoding="utf-8")
    print("wrote", OUT, OUT.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
