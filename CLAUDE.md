# JagsHouseofWews

A family and church archive of KJV Bible teaching (https://fbckjv.app/JagsHouseofWews/studies/).

## Rules

- **Lessons use the deck template.** Any new lesson, and any older lesson rebuilt for review, is a slide deck made with
  `tools/build_deck.py` and `tools/deck/template.html` from a source in `lessons/src/*.deck`. Do not hand-write lesson
  HTML or add PDF-only lessons. Keep the outline or notes as a secondary part where they exist, and link a deck to
  related studies and lessons with `[[lesson:id|label]]` or `read:`.
  The deck is the deliverable. Do not add worksheets, answer keys or handouts unless the user asks.
  Every old hand-made page is being moved onto the template. The list and order are in `review/deck_migration.md`:
  take the next unchecked lesson from it, and move its row to Done in the same PR.

## Building a slide deck

When the user asks for a slide deck from a study, outline, sermon, post or other source in the app, do this directly,
in the repo, without publishing artifacts or building a separate page:

1. Read the source (the study or teaching text, the outline in `studies/data/notes/`, or the lesson in
   `review/lessons.json`).
2. Write `lessons/src/<id>.deck` and build it with `python3 tools/build_deck.py`. Use the template's elements (see the
   top of `tools/build_deck.py`). Scripture is pulled from the KJV by the builder, so never type verse text by hand.
3. Fact-check dates, names, places and quotations against primary sources before they go on a slide. Quote the
   primary text, not a summary or an AI answer. Where a source is missing or a claim is a tradition, say so on the
   slide or leave it out. Correct errors, including ones in the user's source, and tell the user what changed.
   Ask the user instead of deciding anything that is their opinion or doctrine.
4. Fix typos and spelling in the user's source. Leave their wording otherwise.
5. Add the deck as the "Slides" part of the lesson in `review/lessons.json` (keep the outline as a secondary part),
   run `python3 tools/build_lessons.py`, and link related studies and lessons with `[[lesson:id|label]]` or `read:`.
6. Check the deck at desktop and phone width (long words must not run off the screen), bump `APP_VERSION` in
   `studies/app.js` and the cache name in `studies/sw.js`, and send the user the full changed files.
7. Open a PR and wait for the user to say "merge".
- **Daily studies written in Google Drive.** The author saves new studies as Google Docs and announces the link here for
  the app. Read the doc with the Google Drive tools, then add it to `review/refile.json` under `"drive"`:
  `{"to": "Psalms 52", "title": "Doeg", "date": "YYYY-MM-DD", "drive": "<file id>", "text": "<study text>"}`.
  In the text, put each quoted passage as `**Ref**` on one line and the verse in italics on the next (`*verse*`),
  and compare every quoted verse to the KJV text (fix only punctuation and plain slips). Leave the author's wording.
  Run `python3 tools/clean_studies.py`, bump the version, open a PR, and merge only on "merge" (or when the author
  says to add it and merge). The study appears as another tab on that chapter, with no Telegram link.
- Whenever a file is changed, give the user the full file (SendUserFile), not fragments.
- Links go one way only: nothing is ever added to fbckjv.app.
- The "View on Telegram" buttons are off (`TELEGRAM_LINKS` in `studies/app.js`) because the text is in the app. The 69
  photos, a video and an animation that exist only on Telegram keep their link until they are saved here.
- Do not change the KJV language. Non-KJV pastes are corrected to the KJV.
- Fix the user's typos, but otherwise leave their wording. Where a date, place or name is wrong, correct it.
  Where something is the user's opinion or a judgment call, ask instead of changing it.
- Merge a PR only when the user says "merge".
