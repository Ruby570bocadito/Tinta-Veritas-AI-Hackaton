# How to run everything

## The app

```
cd web
npm install
npm run dev            # open the address it prints, ideally on a phone
npm run check:model    # the TypeScript model must match the Python predictions
```

Add `?study` to the address to show anonymous timings at the end, or `?closer` to always show the closer look.

## The experiments

```
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
cd ml
../.venv/Scripts/python ablation.py
```

Saved outputs are in `ml/results/`, in the order the work happened:

| File | Script | Question |
|---|---|---|
| `1_feasibility.txt` | `feasibility.py` | Is there any signal in measures a phone can take? |
| `2_few_tasks_vs_stopwatch.txt` | `experiments.py` | With few tasks, does a model beat a stopwatch? (No.) |
| `3_model_search.txt` | `model_search.py` | Does any model family beat it? (Only with all 25 tasks.) |
| `4_device_shift.txt` | `device_shift.py` | What happens to a stopwatch when the device is uniformly slower? |
| `6_deep_search.txt` | `deep_search.py` | 64 combinations of task count, measures and model (first design, with the warm-up measure). |
| `8_ablation.txt` | `ablation.py` | What is the model really using? What breaks it? Slow and fast writers. |
| `7_adaptive.txt` | `adaptive.py` | The shipped adaptive check (two measures per task). |
| `5_shipped_model.txt` | `train_export.py` | Trains the shipped models and writes `web/src/model.json`. |

Files 2, 3, 4 and 6 belong to the first design, which also measured each task against the person's own warm-up pace. `ablation.py` showed that measure adds almost nothing, so the shipped model dropped it. They are kept because they are how the decision was reached.

`figures.py` redraws the charts in `docs/`. `own_data.py` analyses volunteers recorded with the app's study mode.

## The Android app

```
cd web && npm run build
cd ../android && ./gradlew assembleDebug
node android/tools/emulator-check.mjs shot.png   # end-to-end check with real touch events on an emulator
```
