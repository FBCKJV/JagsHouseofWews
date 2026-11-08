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
3. Do not fact-check the author's sources, historical claims or doctrinal judgments, and do not question or soften them.
   The author makes their own points (for example, Constantine is called a pagan because he never believed the gospel
   and trusted in water baptism; that is the point being made, not a claim to verify against what the world, Catholics
   or other religions say). In the same way, the author's teaching that the Jews who reject Christ are reprobate
   silver, rejected of God, and that the Chabad / Noahide hope of a world kingdom with the Gentiles as servants is the
   beast system of the tribulation, is his doctrine: keep it in his words, do not drop it. Fix only basic spelling and typos, plain date or number slips (a year that contradicts the
   page's own text), and a Bible reference that plainly does not match the verse quoted. Bible text is always the KJV.
   Ask the user only when two old pages truly contradict each other or something looks dropped.
4. Fix typos and spelling in the user's source. Leave their wording otherwise.
5. Add the deck as the "Slides" part of the lesson in `review/lessons.json` (keep the outline as a secondary part),
   run `python3 tools/build_lessons.py`, and link related studies and lessons with `[[lesson:id|label]]` or `read:`.
6. Follow "Deck style" below, and run `node tools/check_decks.js <built decks>` until it passes. Bump `APP_VERSION`
   in `studies/app.js` and the cache name in `studies/sw.js`, and send the user the full changed files.
7. Open a PR and wait for the user to say "merge".

## Deck style (the same in every deck)

- **Look and controls.** Every deck gets its look from `tools/deck/template.html` and `lessons/deck-extras.js`, never
  from styling of its own. Every deck has Share, Full screen, **Projector** (P: bright words on a black screen, type
  grown to fill the screen, Crimson Pro with bold references) and **Day / Night** (D: dark words on a light page);
  both are remembered across decks. A change to the look goes in the template or `deck-extras.js`, so every deck
  gets it on the next build.
- **Verse callouts.** All Bible text comes from the KJV through the builder. The passage being taught is
  `scripture:`, with `mark:` on its key words; one key verse alone is `big:`. A cross reference is a `fig:` card of
  one or two verses with a line from the author (longer passages are tap-to-read buttons, not cards). Any other verse
  is a `[[ref]]` button in the sentence it belongs to, never a `refs:` row at the bottom of a slide (only the title
  slide has a `refs:` row). Other people's words that open like a verse use `say:`.
- **A class keeps one pattern.** Every deck in a series follows the pattern of its first decks:
  - *Genesis class* (Genesis 1–5 and 8 on): title slide with overline "Young Adult Sunday School • Genesis Series",
    heading "Genesis N: Title", a `sub:` of themes joined by " • ", and the chapter as its `refs:`. Then the whole
    chapter in order, verse by verse: kicker `vv. a–b`, a `sub:` line, the `scripture:`, and one `p:` of the author's
    words (no `p:` where he said nothing on those verses). Cross references: kicker "Cross references • Genesis N:v",
    two `fig:` cards and a `callout:`, then ", continued" slides. The author's own applications: kicker
    "Application • …". The deck ends on one `center:` line.
  - *Job class*: the layout note at the top of `lessons/src/job-3-31-job-and-his-friends.deck`.
  - A new series writes its pattern in a comment at the top of its first deck; later decks follow it.
- **Fit.** Every slide fits with no scrolling on a laptop (1280×800, 1440×900) and in Projector mode on a big screen
  or projector (1920×1080, 1280×720, 1024×768). On a phone nothing runs off the side; a long slide may scroll down.
  `node tools/check_decks.js` checks all of this. A slide that fails is split in its source at a line break,
  wording unchanged, with its kicker repeated and ", continued" on the title. Never shrink the type to make a fit.
- Each deck source starts with a comment naming the posts it was built from and every typo or slip fixed.
- **Daily studies written in Google Drive.** The author saves new studies as Google Docs and announces the link here for
  the app. Read the doc with the Google Drive tools, then add it to `review/refile.json` under `"drive"`:
  `{"to": "Psalms 53", "id": "psalms-53", "date": "YYYY-MM-DD", "series": true, "scripture": "<chapter text>", "text": "<study>"}`
  for the day's study in the series (it becomes the chapter's study and "Latest in the series"; put the chapter's KJV
  text, built from the KJV, in "scripture"), or `{"to": "Psalms 52", "title": "Doeg", "date": ..., "id": ..., "text": ...}`
  for a stand-alone study that sits as its own titled tab beside the chapter's study.
  Never store or publish the Drive link or file id anywhere in the repo, in commit messages or in pull requests.
  In the text, put each quoted passage as `**Ref**` on one line and the verse in italics on the next (`*verse*`),
  and compare every quoted verse to the KJV text (fix only punctuation and plain slips). Leave the author's wording.
  Run `python3 tools/clean_studies.py`, bump the version, open a PR, and merge only on "merge" (or when the author
  says to add it and merge). The study appears as another tab on that chapter, with no Telegram link.
- **Running notes.** The author's to-do list is `review/todo.md`. When the author says they want to do something
  later (a study to write, a chapter to redo), add it there; check items off when they are done.
- Whenever a file is changed, give the user the full file (SendUserFile), not fragments.
- Links go one way only: nothing is ever added to fbckjv.app.
- The "View on Telegram" buttons are off (`TELEGRAM_LINKS` in `studies/app.js`) because the text is in the app. The 69
  photos, a video and an animation that exist only on Telegram keep their link until they are saved here.
- Do not change the KJV language. Non-KJV pastes are corrected to the KJV.
- Fix the user's typos, but otherwise leave their wording. Do not change their historical claims, doctrine or tone.
  Correct only basic spelling and plain date or number slips.
- Merge a PR only when the user says "merge".
