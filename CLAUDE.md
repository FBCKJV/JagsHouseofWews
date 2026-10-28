# JagsHouseofWews

A family and church archive of KJV Bible teaching (https://fbckjv.app/JagsHouseofWews/studies/).

## Rules

- **Lessons use the deck template.** Any new lesson, and any older lesson rebuilt for review, is a slide deck made with
  `tools/build_deck.py` and `tools/deck/template.html` from a source in `lessons/src/*.deck`. Do not hand-write lesson
  HTML or add PDF-only lessons. Keep the outline or notes as a secondary part where they exist, and link a deck to
  related studies and lessons with `[[lesson:id|label]]` or `read:`.
- Whenever a file is changed, give the user the full file (SendUserFile), not fragments.
- Links go one way only: nothing is ever added to fbckjv.app.
- Do not change the KJV language. Non-KJV pastes are corrected to the KJV.
- Fix the user's typos, but otherwise leave their wording. Where a date, place or name is wrong, correct it.
  Where something is the user's opinion or a judgment call, ask instead of changing it.
- Merge a PR only when the user says "merge".
