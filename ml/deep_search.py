"""Thorough model search for the device-independent test, without fooling ourselves.

With 174 people, "training harder" mostly means searching more carefully and measuring honestly.
Everything is nested: for each of 25 outer test folds, the tasks AND the model settings are chosen
using only the training people of that fold.

Searched:
  - how many scored tasks (3 to 6), on top of the 2 warm-ups
  - which measures: basic (3 per task) or rich (6 per task), all relative to the person's own pace
  - which model: logistic, linear SVM, RBF SVM, k-nearest neighbours, random forest,
    gradient boosting, a small neural network, and the average of the best three

Run:  python ml/deep_search.py     (about 10 minutes)
"""
import json
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import GridSearchCV, RepeatedStratifiedKFold, StratifiedKFold
from sklearn.neighbors import KNeighborsClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

from device_shift import HARD, WARMUP, logit, pick, relative

warnings.filterwarnings("ignore")
HERE = Path(__file__).resolve().parent
DATA = HERE.parent / "data" / "darwin" / "data.csv"
KS = [3, 4, 5, 6]


def rich(df, tasks):
    """Six device-independent measures per task. A uniform change of speed cancels out of all of them."""
    warm = np.log(df[[f"total_time{t}" for t in WARMUP]].values.astype(float)).mean(1)
    cols = []
    for t in tasks:
        air = df[f"air_time{t}"].values.astype(float)
        paper = df[f"paper_time{t}"].values.astype(float)
        total = np.maximum(df[f"total_time{t}"].values.astype(float), 1)
        n = np.maximum(df[f"num_of_pendown{t}"].values.astype(float), 1)
        w = np.exp(warm)  # the person's own pace, in the device's own units
        cols += [np.log(total) - warm,                          # slower than own warm-up
                 air / total,                                   # share of time in the air
                 np.log1p(n),                                   # touches
                 np.log(air / n / w + 0.01),                    # length of a typical pause, vs own pace
                 np.log(paper / n / w + 0.01),                  # length of a typical stroke, vs own pace
                 np.log((air / w + 0.01) / (paper / w + 0.01))]  # air against paper
    return np.column_stack(cols)


FEATURES = {"basic": relative, "rich": rich}
INNER = StratifiedKFold(n_splits=4, shuffle=True, random_state=0)


def grid(model, params):
    return GridSearchCV(make_pipeline(StandardScaler(), model), params, cv=INNER, scoring="roc_auc", n_jobs=-1)


MODELS = {
    "logistic": lambda: grid(LogisticRegression(max_iter=5000), {"logisticregression__C": [0.03, 0.1, 0.3, 1, 3]}),
    "linear SVM": lambda: grid(SVC(kernel="linear", probability=True, random_state=0), {"svc__C": [0.03, 0.1, 0.3, 1]}),
    "RBF SVM": lambda: grid(SVC(probability=True, random_state=0),
                            {"svc__C": [0.3, 1, 3, 10], "svc__gamma": ["scale", 0.01, 0.03]}),
    "k-nearest": lambda: grid(KNeighborsClassifier(), {"kneighborsclassifier__n_neighbors": [5, 9, 15, 21]}),
    "random forest": lambda: grid(RandomForestClassifier(300, random_state=0),
                                  {"randomforestclassifier__max_depth": [3, 5, None],
                                   "randomforestclassifier__min_samples_leaf": [1, 3, 5]}),
    "boosting": lambda: grid(HistGradientBoostingClassifier(random_state=0),
                             {"histgradientboostingclassifier__max_depth": [2, 3],
                              "histgradientboostingclassifier__learning_rate": [0.03, 0.1],
                              "histgradientboostingclassifier__max_iter": [100, 200]}),
    "neural net": lambda: grid(MLPClassifier(max_iter=2000, random_state=0),
                               {"mlpclassifier__hidden_layer_sizes": [(8,), (16,), (16, 8)],
                                "mlpclassifier__alpha": [0.01, 0.1, 1]}),
}
BLEND = ["logistic", "RBF SVM", "random forest"]


def main():
    df = pd.read_csv(DATA)
    y = (df["class"] == "P").astype(int).values
    outer = RepeatedStratifiedKFold(n_splits=5, n_repeats=5, random_state=7)
    scores = {}  # (k, features, model) -> list of (acc, sens, spec, auc)
    picks = []

    def add(key, y_te, p):
        pred = (p >= 0.5).astype(int)
        scores.setdefault(key, []).append(((pred == y_te).mean(), pred[y_te == 1].mean(),
                                           1 - pred[y_te == 0].mean(), roc_auc_score(y_te, p)))

    for fold, (tr, te) in enumerate(outer.split(df, y), 1):
        dtr, dte = df.iloc[tr], df.iloc[te]
        order = pick(dtr, y[tr], max(KS), logit, relative, HARD)  # tasks chosen with training people only
        picks.append(order)
        for k in KS:
            for fname, feats in FEATURES.items():
                Xtr, Xte = feats(dtr, order[:k]), feats(dte, order[:k])
                probs = {}
                for mname, make in MODELS.items():
                    probs[mname] = make().fit(Xtr, y[tr]).predict_proba(Xte)[:, 1]
                    add((k, fname, mname), y[te], probs[mname])
                add((k, fname, "blend of 3"), y[te], np.mean([probs[m] for m in BLEND], axis=0))
        print(f"fold {fold}/25 done", flush=True)

    rows = []
    for (k, fname, mname), vals in scores.items():
        a = np.array(vals)
        m = a.mean(0)
        # 95% interval of the mean accuracy across the 25 outer folds
        lo, hi = np.percentile(a[:, 0], [2.5, 97.5])
        rows.append(dict(tasks=k, measures=fname, model=mname, accuracy=m[0], acc_sd=a[:, 0].std(),
                         fold_lo=lo, fold_hi=hi, sensitivity=m[1], specificity=m[2], auc=m[3]))
    table = pd.DataFrame(rows).sort_values("auc", ascending=False)
    pd.set_option("display.width", 200)
    print("\nAll settings, best AUC first (accuracy on unseen people, 5-fold x 5 repeats, fully nested)\n")
    print(table.to_string(index=False, float_format=lambda v: f"{v:.3f}"))
    print("\nBest by number of tasks:")
    for k in KS:
        b = table[table.tasks == k].iloc[0]
        print(f"  {k} tasks: {b.model} on {b.measures} measures -> accuracy {b.accuracy:.3f} ±{b.acc_sd:.3f}, "
              f"sensitivity {b.sensitivity:.3f}, specificity {b.specificity:.3f}, AUC {b.auc:.3f}")
    from collections import Counter
    for k in KS:
        print(f"  tasks most often chosen in the first {k}:", Counter(t for o in picks for t in o[:k]).most_common(k + 2))
    table.to_json(HERE / "results" / "6_deep_search.json", orient="records", indent=1)


if __name__ == "__main__":
    main()
