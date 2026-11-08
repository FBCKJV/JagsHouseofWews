#!/usr/bin/env node
/* Check built slide decks against the deck rules in CLAUDE.md ("Deck style").

     node tools/check_decks.js lessons/genesis/genesis-8-while-the-earth-remaineth.html   # one or more decks
     node tools/check_decks.js                                                           # every deck built from lessons/src

   Every slide must fit, with no scrolling, in:
     - the usual look on a laptop: 1280x800 and 1440x900
     - Projector mode on a big screen or projector: 1920x1080, 1280x720 and 1024x768
   and nothing may run off the side of the screen on a phone (390x844). On a phone a long slide may scroll down.
   A slide that fails is split in its deck source at a line break, wording unchanged, with its kicker repeated.
   Prints one line per failing slide and exits 1 if any fail. */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const ROOT = path.dirname(__dirname);
const SLACK = 4;   // px of rounding allowed

function allDecks() {
  const src = path.join(ROOT, 'lessons', 'src');
  return fs.readdirSync(src).filter(f => f.endsWith('.deck')).map(f => {
    const m = fs.readFileSync(path.join(src, f), 'utf8').match(/^output:\s*(.+)$/m);
    return m ? path.join(ROOT, m[1].trim()) : null;
  }).filter(f => f && fs.existsSync(f));
}

const VIEWS = [
  { name: 'laptop 1280x800', w: 1280, h: 800, proj: false, down: true },
  { name: 'laptop 1440x900', w: 1440, h: 900, proj: false, down: true },
  { name: 'projector 1920x1080', w: 1920, h: 1080, proj: true, down: true },
  { name: 'projector 1280x720', w: 1280, h: 720, proj: true, down: true },
  { name: 'projector 1024x768', w: 1024, h: 768, proj: true, down: true },
  { name: 'phone 390x844', w: 390, h: 844, proj: false, down: false },
];

(async () => {
  const files = process.argv.slice(2).map(f => path.resolve(f));
  const decks = files.length ? files : allDecks();
  const browser = await chromium.launch();
  let failures = 0;
  for (const v of VIEWS) {
    const page = await browser.newPage({ viewport: { width: v.w, height: v.h } });
    // Projector and Day/Night are remembered in localStorage; start each view from a known state.
    for (const file of decks) {
      await page.goto('file://' + file + (v.proj ? '?projector=1' : ''));
      await page.evaluate(proj => { try { localStorage.setItem('kjv_projector', proj ? '1' : '0'); localStorage.setItem('kjv_deck_day', '0'); } catch (e) {} }, v.proj);
      await page.reload();
      await page.waitForTimeout(200);
      const n = await page.$$eval('.slide', s => s.length);
      for (let i = 0; i < n; i++) {
        const r = await page.evaluate(async i => {
          go(i);
          await new Promise(r => setTimeout(r, 120));
          const s = document.querySelectorAll('.slide')[i];
          const h = s.querySelector('h1,h2');
          return { down: s.scrollHeight - s.clientHeight, side: document.documentElement.scrollWidth - innerWidth,
                   title: h ? h.textContent.trim() : '' };
        }, i);
        const bad = [];
        if (v.down && r.down > SLACK) bad.push(`scrolls ${r.down}px`);
        if (r.side > 0) bad.push(`runs ${r.side}px off the side`);
        if (bad.length) {
          failures++;
          console.log(`${v.name}  ${path.relative(ROOT, file)}  slide ${i + 1} "${r.title}": ${bad.join(', ')}`);
        }
      }
    }
    await page.close();
  }
  await browser.close();
  console.log(failures ? `${failures} slide checks failed` : `All ${decks.length} decks fit.`);
  process.exit(failures ? 1 : 0);
})();
