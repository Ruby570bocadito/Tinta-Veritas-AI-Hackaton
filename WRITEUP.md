# Tinta: a two-minute handwriting check that says when it cannot tell

**Track:** AI + Health · **Team:** solo · **Starting point:** my own idea

**Try it:** https://ruby570bocadito.github.io/Tinta-Veritas-AI-Hackaton/ · **Video:** https://youtu.be/wcvMvbPzyQg · **Code and full results:** [README](README.md)

> This project is a prototype and is not medical advice.

## Problem

A family notices that an older relative repeats questions. Is it age, or should they see a doctor about Alzheimer's? People with Alzheimer's hesitate more while writing, but the hesitation happens with the pen in the air, so paper hides it. In a public study, copying a four-letter word backwards, the pen of the Alzheimer's group spent 7.5 s in the air against 1.9 s for the healthy group (medians).

## What I built

A web app (also Android) that times those pauses on a phone. The person does two practice tasks and three scored ones with a finger; Tinta, a paper squid, draws each task first. Then she replays the "invisible ink" (where the finger left the screen, and for how long) and answers **usual pattern**, **worth mentioning to a doctor** or **I can't tell**. If a task was not really done, she gives **no result** instead of a guess. It works offline and nothing leaves the phone.

## How it works

**Data:** DARWIN, 174 people (89 with Alzheimer's, 85 healthy), 25 tasks with a pen on a tablet. **Model:** logistic regression on two numbers per task that do not depend on overall speed: the share of time in the air and the number of touches. When it is unsure, three more short tasks follow and three models (logistic regression, SVM, random forest) are averaged. The model runs in the browser and is checked against scikit-learn in the tests.

## Results (nested 5-fold cross-validation)

| | Accuracy | Patients caught | Healthy flagged |
|---|---|---|---|
| Baseline: a stopwatch (total time of 3 tasks) | 80% | 78% | 19% |
| Tinta, adaptive (3.9 tasks on average) | 76% | 73% | 21% |

**My model does not beat a stopwatch on the study's tablet.** What it buys is independence from the device: in a simulation, on a phone twice as fast the stopwatch misses 77% of patients, and on one twice as slow it flags 92% of healthy people, while a share and a count do not change.

## Testing and where it fails

- **18 healthy volunteers on real phones:** nobody was wrongly flagged. But 9 of the first 17 wrote the word without lifting the finger, and a phone cannot see a finger in the air. So Tinta now gives no result in that case, asks for the word letter by letter and draws every task first. Only one volunteer is over 59, and **no patient has tried it on a phone**.
- A tester got "usual pattern" by scribbling: geometry now checks each task, with 81 automated checks and 28 made-up people in the tests.
- Slow healthy writers are flagged more often (35% against 15 to 18%). Patients in the study were already diagnosed, so this is not early detection.

## What I'd do next

Record people over 65 and people with a diagnosis on real phones, and relearn the thresholds from finger data.

## Sources

DARWIN (Fontanella, 2022), UCI Machine Learning Repository, CC BY 4.0, https://doi.org/10.24432/C55D0K. Libraries: scikit-learn, pandas, NumPy, React, Vite. Images: Meta's Muse Image model. AI tool: Claude Code (Anthropic) helped plan, write and debug code, draft text and play testers; I ran and checked every experiment and can explain each part.
