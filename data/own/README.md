# Our own data

`volunteers.jsonl` holds one line per healthy volunteer who did the check with a finger on a real phone.

- Everyone was asked first: "I am going to save how long each task takes you, without your name, for a school project. Is that OK?"
- Saved: time in the air, time on the screen, total time and number of touches per task, an age band, and the language of the app.
- Not saved: name, exact age, the drawing itself, anything about health.
- Each line is exactly what the app shows in study mode (add `?study` to the address). "Save this person" keeps the lines on the phone and "Copy all" copies them together.

Analysed by `ml/own_data.py`.
