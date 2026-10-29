# Moving every lesson onto the deck template

Goal: every lesson is a deck built by `tools/build_deck.py` from `lessons/src/<id>.deck`. No hand-made HTML pages, bundled exports, infographics or charts as standalone pages; a chart or infographic becomes slides inside its lesson's deck. Notes fragments (`studies/data/notes/`) stay as the secondary "Notes" part. Follow "Building a slide deck" in `CLAUDE.md` for each one.

Pick the next lesson from the top of the "To do" list. When one is finished, move its row to "Done" in the same PR.

## To do

### 1. Slide-style pages (closest to the template)
Already slides, so mostly a mechanical rebuild plus the fact-check and typo pass. John 6's narrated copy and its read-aloud player were retired: the author said the browser voices are not good, so read-aloud is dropped for now. `saved-christian-now-what` (824 KB) and `fundamentalism-vs-vain-philosophy` (420 KB) embed images; `conditional-promises` uses its own `deck-stage.js`.


### 2. Doctrine weeks 1 to 10
Week 7 and Week 8 infographics and the Week 4 pronouns chart become slides inside their week's deck. Worksheets and answer keys stay as notes parts, but are not rebuilt.


### 3. Genesis 1 to 5
Genesis 2 has two different lessons that overlap on the design of marriage: `marriage` (Genesis 2 and God's design) and `marriage-and-divorce` (young adult Sunday school, adds divorce). Per the user, they stay separate decks, like the two Genesis 6 lessons.

- [ ] **Genesis 1: Creation** (`genesis-1-creation`): Slides `genesis/genesis-1-creation.html`
- [ ] **Genesis 2: Marriage** (`genesis-2-marriage`): Slides `genesis/genesis-2-marriage.html`
- [ ] **Genesis 2: Marriage and Divorce** (`genesis-2-marriage-and-divorce`): Slides `genesis/genesis-2-marriage-and-divorce.html`
- [ ] **Genesis 3: The Fall** (`genesis-3-the-fall`): Slides `genesis/genesis-3-the-fall.html`
- [ ] **Genesis 4: Cain and Abel** (`genesis-4-cain-and-abel`): Slides `genesis/genesis-4-cain-and-abel.html`
- [ ] **Genesis 5: The Generations of Adam** (`genesis-5-generations-of-adam`): Slides `genesis/genesis-5-generations-of-adam.html`

### 4. Heresies and charts
The election chart becomes a table slide.

- [ ] **That Rock Was Christ, Not Peter** (`heresies-that-rock-was-christ`): Slides `heresies/heresies-that-rock-was-christ.html`
- [ ] **Election in the Bible** (`election-in-the-bible`): Chart `heresies/election-in-the-bible.html`

### 5. Baptist history
`baptist-groups-compared` has an SVG chart; rebuild as comparison slides.

- [ ] **Baptist Voices** (`baptist-voices`): Slides `history/baptist-voices.html`
- [ ] **Baptist Names in History** (`baptist-names-in-history`): Slides `history/baptist-names-in-history.html`
- [ ] **Baptist Groups Compared** (`baptist-groups-compared`): Slides `history/baptist-groups-compared.html`

### 6. Romans class (17 lessons, about 50 pages)
Each chapter has a main page plus several side pages, recaps, charts and worksheets. Following the Week 5 model, fold each chapter into ONE deck and retire the side pages. This is the biggest piece, so it goes last and chapter by chapter.

- [ ] **Romans: Who Is Paul, and How Romans Argues** (`romans-class-romans-intro`): Slides: Who is Paul? `romans/romans-intro-paul1.html`; Slides: A logical argument `romans/romans-intro-diatribe.html`
- [ ] **Romans 1: The Wrath of God Revealed** (`romans-class-romans-1`): Slides `romans/romans-1-romans1-18-32.html`; Review `romans/romans-1-romasn1-reviewpic.html`
- [ ] **Romans 2: The Inescapable Judgment** (`romans-class-romans-2`): Slides `romans/romans-2-romasn2-1.html`
- [ ] **Romans 3: All Are Guilty, Saved by Grace** (`romans-class-romans-3`): Romans 3 (KJV, for projection) `romans/romans-3-romans-3kjv.html`; Slides: The oracles of God `romans/romans-3-oracles.html`; Slides: God's plan for the heathen `romans/romans-3-romans-3-gentiles.html`; Slides: A finished work `romans/romans-3-reconciliation.html`
- [ ] **Romans 4: Abraham Believed God** (`romans-class-romans-4`): Slides `romans/romans-4-romans-4-3-0.html`; Slides: Abraham `romans/romans-4-abraham.html`; Chart: Adam to the twelve tribes `romans/romans-4-abraham-lineage.html`
- [ ] **Romans 5: Peace and Grace** (`romans-class-romans-5`): Slides `romans/romans-5-romans-5.html`; Slides: Atonement and reconciliation `romans/romans-5-atonement.html`; Slides: Genesis 3 `romans/romans-5-genesis-3-for-romans-5.html`; Key verses `romans/romans-5-romans-summary-5.html`
- [ ] **Romans 6: Dead to Sin, Alive in Christ** (`romans-class-romans-6`): Slides `romans/romans-6-romans-6.html`; Slides: Baptism into Christ `romans/romans-6-baptisms.html`; Recap of Romans 1-5 `romans/romans-6-romans-1-5-summary.html`; Worksheet `romans/romans-6-worksheet.html`
- [ ] **Romans 7: The Struggle with Sin** (`romans-class-romans-7`): Slides `romans/romans-7-romans-7.html`; Slides: The age of accountability `romans/romans-7-romans-age-of-accountability.html`; Slides: Flesh against the new man `romans/romans-7-owrechedman7.html`
- [ ] **Romans 8: No Condemnation** (`romans-class-romans-8`): Slides `romans/romans-8-roman-8.html`
- [ ] **Romans 9: God's Word Has Not Failed** (`romans-class-romans-9`): Slides `romans/romans-9-romans-9.html`; Slides: Jacob loved, Esau hated `romans/romans-9-esau-jacob.html`; Slides: Choosing the weak and foolish `romans/romans-9-replacements.html`; Slides: Galatians 3-4 parallels `romans/romans-9-galatians-3-4-parallels.html`; Recap of Romans 1-8 `romans/romans-9-romans-1-8recap.html`
- [ ] **Romans 10: Salvation by Faith** (`romans-class-romans-10`): Slides `romans/romans-10-romans-10.html`; Slides: A call to soul winning `romans/romans-10-soulwinning.html`
- [ ] **Romans 11: God's Mercy and Faithfulness** (`romans-class-romans-11`): Slides `romans/romans-11-romans-11.html`; Slides: Paul's lament `romans/romans-11-pauls-lament-for-the-jews.html`; Slides: One people of God `romans/romans-11-israelofgod.html`; Slides: Dispensation `romans/romans-11-dispensation-in-the-bible.html`; Chart: A spectrum of beliefs `romans/romans-11-a-spectrum-of-beliefs-dispensationalism.html`; Summary of Romans 9-11 `romans/romans-11-summary.html`
- [ ] **Romans 12: A Living Sacrifice** (`romans-class-romans-12`): Slides `romans/romans-12-romans-12.html`
- [ ] **Romans 13: Subject to the Higher Powers** (`romans-class-romans-13`): Slides `romans/romans-13-romans-13.html`; Slides: God-given authority `romans/romans-13-government.html`; Slides: Daniel 1 `romans/romans-13-daniel-1.html`
- [ ] **Romans 14: Receive One Another** (`romans-class-romans-14`): Slides `romans/romans-14-romans14.html`; Slides: Liberty in Christ `romans/romans-14-liberty-in-christ.html`; Slides: Church discipline `romans/romans-14-church-discipline.html`
- [ ] **Romans 15: Unity, Edification and Hope** (`romans-class-romans-15`): Slides `romans/romans-15-romans-15.html`; Slides: Christ fulfils the prophets `romans/romans-15-christ-came-to-fufil-the-prophets.html`
- [ ] **Romans 16: Greetings, Warnings and the Doxology** (`romans-class-romans-16`): Slides `romans/romans-16-romans-16.html`; Slides: The named saints `romans/romans-16-romans-16-names.html`

## Done

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
