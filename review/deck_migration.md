# Moving every lesson onto the deck template

Goal: every lesson is a deck built by `tools/build_deck.py` from `lessons/src/<id>.deck`. No hand-made HTML pages, bundled exports, infographics or charts as standalone pages; a chart or infographic becomes slides inside its lesson's deck. Notes fragments (`studies/data/notes/`) stay as the secondary "Notes" part. Follow "Building a slide deck" in `CLAUDE.md` for each one.

**Every lesson is now a template deck.** New lessons follow `CLAUDE.md`: write `lessons/src/<id>.deck`, build it, and add it to `review/lessons.json`.

## To do

### 1. Slide-style pages (closest to the template)
Already slides, so mostly a mechanical rebuild plus the fact-check and typo pass. John 6's narrated copy and its read-aloud player were retired: the author said the browser voices are not good, so read-aloud is dropped for now. `saved-christian-now-what` (824 KB) and `fundamentalism-vs-vain-philosophy` (420 KB) embed images; `conditional-promises` uses its own `deck-stage.js`.


### 2. Doctrine weeks 1 to 10
Week 7 and Week 8 infographics and the Week 4 pronouns chart become slides inside their week's deck. Worksheets and answer keys stay as notes parts, but are not rebuilt.


### 3. Genesis 1 to 5
Genesis 2 has two different lessons that overlap on the design of marriage: `marriage` (Genesis 2 and God's design) and `marriage-and-divorce` (young adult Sunday school, adds divorce). Per the user, they stay separate decks, like the two Genesis 6 lessons.


### 4. Heresies and charts
The election chart becomes a table slide.


### 5. Baptist history
`baptist-groups-compared` has an SVG chart; rebuild as comparison slides.


### 6. Romans class (17 lessons, about 50 pages)
Each chapter has a main page plus several side pages, recaps, charts and worksheets. Following the Week 5 model, fold each chapter into ONE deck and retire the side pages. This is the biggest piece, so it goes last and chapter by chapter.


## Next: decks for the notes-only lessons

Chapter-by-chapter decks are made only as a book is taught. The deck work now goes to the doctrine topics (salvation
and assurance first) and then to the lessons that are notes or posts with no slides yet. The notes stay as
the lesson's secondary part; the deck becomes its "Slides" part. Same rules: the author's own wording, KJV from the
builder, no fact-checking of the author's views. Order:

1. ~~Standalone posts (6)~~ done
2. ~~Answering error (9)~~ done
3. ~~Baptist & church history (10)~~ done
4. Prophecy (4), the Doctrine class notes (3), Bible lessons (2)

Sermons and the lessons from other preachers do not get decks. They stay as notes.

## Done

- [x] **Romans: Who Is Paul, and How Romans Argues** (`romans-class-romans-intro`)
- [x] **Romans 1: The Wrath of God Revealed** (`romans-class-romans-1`)
- [x] **Romans 2: The Inescapable Judgment** (`romans-class-romans-2`)
- [x] **Romans 3: All Are Guilty, Saved by Grace** (`romans-class-romans-3`)
- [x] **Romans 4: Abraham Believed God** (`romans-class-romans-4`)
- [x] **Romans 5: Peace and Grace** (`romans-class-romans-5`)
- [x] **Romans 6: Dead to Sin, Alive in Christ** (`romans-class-romans-6`)
- [x] **Romans 7: The Struggle with Sin** (`romans-class-romans-7`)
- [x] **Romans 8: No Condemnation** (`romans-class-romans-8`)
- [x] **Romans 9: God's Word Has Not Failed** (`romans-class-romans-9`)
- [x] **Romans 10: Salvation by Faith** (`romans-class-romans-10`)
- [x] **Romans 11: God's Mercy and Faithfulness** (`romans-class-romans-11`)
- [x] **Romans 12: A Living Sacrifice** (`romans-class-romans-12`)
- [x] **Romans 13: Subject to the Higher Powers** (`romans-class-romans-13`)
- [x] **Romans 14: Receive One Another** (`romans-class-romans-14`)
- [x] **Romans 15: Unity, Edification and Hope** (`romans-class-romans-15`)
- [x] **Romans 16: Greetings, Warnings and the Doxology** (`romans-class-romans-16`)
- [x] **Genesis 1: Creation** (`genesis-1-creation`)
- [x] **Genesis 2: Marriage** (`genesis-2-marriage`)
- [x] **Genesis 2: Marriage and Divorce** (`genesis-2-marriage-and-divorce`)
- [x] **Genesis 3: The Fall** (`genesis-3-the-fall`)
- [x] **Genesis 4: Cain and Abel** (`genesis-4-cain-and-abel`)
- [x] **Genesis 5: The Generations of Adam** (`genesis-5-generations-of-adam`)
- [x] **That Rock Was Christ, Not Peter** (`heresies-that-rock-was-christ`)
- [x] **Election in the Bible** (`election-in-the-bible`)
- [x] **Baptist Voices** (`baptist-voices`)
- [x] **Baptist Names in History** (`baptist-names-in-history`)
- [x] **Baptist Groups Compared** (`baptist-groups-compared`)
- [x] **Week 1: The Importance of Doctrine** (`doctrine-week-1-importance-of-doctrine`)
- [x] **Week 2: How God Reveals Himself to Man** (`doctrine-week-2-how-god-reveals-himself`)
- [x] **Week 3: The Doctrine of Scripture** (`doctrine-week-3-doctrine-of-scripture`)
- [x] **Week 4: The Importance of the KJV** (`doctrine-week-4-importance-of-the-kjv`)
- [x] **Week 6: Terms and Conditions** (`doctrine-week-6-terms-and-conditions`)
- [x] **Week 7: The Doctrine of God (the Father)** (`doctrine-week-7-doctrine-of-god`)
- [x] **Week 8: The Doctrine of Christ** (`doctrine-week-8-doctrine-of-christ`)
- [x] **Week 9: The Doctrine of the Holy Spirit** (`doctrine-week-9-doctrine-of-the-holy-spirit`)
- [x] **Week 10: Marriage, God's Plan for Man and Woman** (`doctrine-week-10-marriage-gods-plan`)
- [x] **Genesis 6: The Days of Noah** (`genesis-6-the-days-of-noah`)
- [x] **Genesis 6: Sons of God** (`genesis-6-sons-of-god`)
- [x] **John 6: The Bread of Life** (`john-6-bread-of-life`)
- [x] **Psalm 50: God Is Judge** (`psalm-50`)
- [x] **Psalm 22: A Cry from the Cross** (`psalm-22`)
- [x] **The Didache** (`didache`)
- [x] **Ignatius and the Lord's Table** (`ignatius-lords-table`)
- [x] **Wise as Serpents** (`wise-as-serpents`)
- [x] **Creation Ex Nihilo** (`heresies-creation-ex-nihilo`)
- [x] **Fundamentalism vs. Vain Philosophy** (`fundamentalism-vs-vain-philosophy`)
- [x] **The Old Testament in Light of the New: Stephen** (`ot-in-light-of-nt-stephen`)
- [x] **The Words of God: Jack Hyles on Inspiration** (`hyles-on-inspiration`)
- [x] **Shadows and Substance: Why the Old Testament Practices** (`doctrine-week-3-ot-shadows-and-substance`)
- [x] **So You're a Saved Christian, Now What?** (`saved-christian-now-what`)
- [x] **Conditional Promises and Covenant Shifts** (`conditional-promises-rightly-dividing`)
- [x] **Week 5: A Trail of Blood and Being Baptist** (`doctrine-week-5-trail-of-blood-and-baptist-history`)
- [x] **Genesis 7: The Flood** (`genesis-7-the-flood`)
- [x] **Early American Baptists: Establishment, Disestablishment and Soul Liberty** (`early-american-baptists`)
- [x] **Daniel 11** (`daniel-11`)
- [x] **John: That Ye Might Believe** (`john-that-ye-might-believe`)

## Standing decisions

- Verses are blocks with the reference below (John 3:16-18), no inline verse numbers. The builder pulls the KJV text.
- Each finished deck gets the shared resume and Share script automatically.
- Fact-check against primary sources; mark traditions; ask the user about anything that is opinion or doctrine.
- Fold pages into one deck only when they are parts of one study (side pages, recaps, narrated copies, charts), as with Week 5 and John 6. Lessons that cover different things stay separate decks, like the two Genesis 6 lessons and the two Genesis 2 lessons.
