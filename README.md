# Tinta

**Track:** AI + Health · **Team:** solo · **Starting point:** my own idea

**[Try it in your browser](https://ruby570bocadito.github.io/Tinta-Veritas-AI-Hackaton/)** (best on a phone; English and Spanish) · Video: <!-- TODO: link -->

> This project is a prototype and is not medical advice.

## The problem

Lucía is 45. Her mother Carmen, 72, repeats questions and left the stove on last week. Is it normal forgetfulness, or should they see a doctor? People with Alzheimer's hesitate more while writing: the pen spends longer in the air. Paper hides that. A touchscreen can time it.

## What I built

A web app (also an offline Android app). Carmen does two practice tasks and three scored ones with her finger: trace a circle, write "le" four times, copy a word backwards. Tinta replays her "invisible ink" (where the finger left the screen, and for how long) and gives one of three answers: **usual pattern**, **worth mentioning to a doctor**, or **I can't tell**. If the short check is unsure, three more tasks follow and three models vote. Nothing leaves the phone.

![Five screens of the app: start, tracing a circle, the invisible ink replay, the closer look, and the result](docs/screens.jpg)

## What I added

The public study needs 25 tasks on a professional tablet. I cut it to tasks that work with a finger, kept only measures that ignore overall speed, tested what breaks that idea, recorded five people on real phones, and built the app, which shows real cases it gets wrong.

## How it works

**Data.** [DARWIN](https://doi.org/10.24432/C55D0K): 174 people (89 diagnosed with Alzheimer's, 85 healthy), 25 handwriting tasks, pen on paper over a tablet.

**Model.** Logistic regression on two numbers per task: the share of the task spent with the pen in the air, and the number of pen-downs. Tasks are chosen by forward selection on training people only. A score between 35 and 65 (a band I set by hand) triggers the closer look: three more tasks, and the average of a logistic regression, an RBF SVM and a random forest. The models run in the browser; `npm test` checks they match scikit-learn to four decimals.

## Results

Nested 5-fold cross-validation, repeated 3 or 4 times.

| On the study's tablet | Accuracy | Patients caught | Healthy flagged |
|---|---|---|---|
| **Baseline: stopwatch rule**, 3 tasks | 80 to 82% | 78% | 19% |
| Baseline: air share alone, 3 tasks | 75% | 75% | 25% |
| Tinta, short check | 74 to 75% | 69% | 18% |
| Tinta, adaptive (4.0 tasks on average) | 77% | 74% | 19% |

**My model does not beat a stopwatch**, and counting pen-downs adds nothing measurable over air share alone. A trained model only wins with all 25 tasks (91% against 81%).

**What people would actually be told** by the adaptive check:

| | Usual pattern | I can't tell | Worth mentioning |
|---|---|---|---|
| Of 100 patients | 19 | 15 | 65 |
| Of 100 healthy people | 74 | 13 | 14 |

**Why bother, then.** A stopwatch threshold is in milliseconds: on a device 1.5 times slower it flags 64% of healthy people. A share and a count ignore overall speed (arithmetic, not a finding).

**Where it fails** (`ml/results/8_ablation.txt`).

![Patients caught and healthy people wrongly flagged under different device changes](docs/what-breaks.png)

- *Devices that change pauses and strokes differently* (simulated). Pauses twice as long: half of healthy people flagged. Strokes twice as long: more than half of patients missed. The simulation keeps pen-downs fixed.
- *On real phones: my own data* (`ml/results/10_own_data.txt`). Five healthy volunteers did the check on their own phones. All five were told "usual pattern" (scores 6 to 24): no false alarms. But a finger does not write like the study's pen. Copying a word backwards, healthy people in the study lifted the pen 4 times and spent 46% of the task in the air; three of my five never lifted the finger in any scored task, which gives the lowest score the model can give. If patients also lift less with a finger, thresholds learned from a pen would miss them. Five people, one of them me. **No patient has tried it on a phone.**
- *Slow writers.* 9 of 26 slow healthy test cases were flagged (35%), against 15 to 18% of the rest. The data has no age or sex, so I could not check those groups.
- *My first idea was wrong.* Each task against the person's own warm-up pace scores 59% alone. Removed.
- *Not early detection.* Patients were already diagnosed and are half the sample; in real life most "worth mentioning" results would be false alarms.

## What I'd do next

Record people with a diagnosis, through a patients' association, on real phones, and relearn the thresholds from finger data. The app's study mode (`?study`) and `ml/own_data.py` already collect and analyse it.

## Sources

- **Dataset:** Fontanella, F. (2022). DARWIN. UCI Machine Learning Repository, CC BY 4.0, https://doi.org/10.24432/C55D0K. Cilia et al. (2022), Engineering Applications of AI. Task list: https://arxiv.org/abs/2405.00755.
- **Code:** scikit-learn, pandas, NumPy, matplotlib; React, Vite, TypeScript, Fontsource; AndroidX WebKit.
- **Images:** Tinta's pictures were generated with Meta's Muse Image model from my prompts.
- **Health facts in "Ask Tinta":** WHO dementia fact sheet; US National Institute on Aging.
- **AI tools:** Claude Code (Anthropic) helped plan, write and debug the code, draft this text and review the project. I ran and checked every experiment and can explain each part.

How to run everything: [`ml/README.md`](ml/README.md). MIT License.
