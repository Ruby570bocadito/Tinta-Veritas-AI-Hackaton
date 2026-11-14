# Tinta

A 2-minute handwriting check on the phone you already own. It measures *how* you write, not *what* you write, and flags patterns worth mentioning to a doctor.

**This project is a prototype and is not medical advice.**

Built during the Veritas AI International High School Hackathon 2026 (track: AI + Health). Work in progress; full write-up coming.

## Data

- DARWIN dataset (Fontanella, 2022), UCI Machine Learning Repository, CC BY 4.0. https://doi.org/10.24432/C55D0K

## Run the feasibility check

```
python -m venv .venv
.venv/Scripts/python -m pip install pandas scikit-learn matplotlib
.venv/Scripts/python ml/feasibility.py
```
