#!/usr/bin/env python3
"""
find_corrections.py - look for mislabeled verse references and likely typos in the commentary.

Usage (from the repo root):
    python3 tools/find_corrections.py

It only proposes. Nothing changes until a fix is copied into review/corrections.json, which
clean_studies.py applies on every run. Checks:
  - reference lines whose quote is a different passage
  - quoted blocks whose wording isn't the KJV (a modern version pasted by mistake)
  - likely spelling mistakes in the commentary (never inside scripture)

Reads:
  telegram_chapter_studies/chapter_studies.json
  the KJV text from the KJV Bible app (https://fbckjv.app/KJVBible/bible/<Book>.json),
    cached in tools/.kjv-cache/ after the first run
  review/corrections.json (fixes already approved are not proposed again)
Writes:
  review/proposed_corrections.md

Typo checking needs the pyspellchecker package (pip install pyspellchecker); without it
only the verse references are checked.
"""
import json, os, re, sys, urllib.request
from collections import Counter, defaultdict
from difflib import SequenceMatcher

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from clean_studies import BOOKS, slug, load_corrections, apply_corrections  # noqa: E402

SRC = os.path.join(ROOT, 'telegram_chapter_studies', 'chapter_studies.json')
OUT = os.path.join(ROOT, 'review', 'proposed_corrections.md')
CACHE = os.path.join(ROOT, 'tools', '.kjv-cache')
KJV_URL = 'https://fbckjv.app/KJVBible/bible/{}.json'

ALIASES = {b.lower(): b for b in BOOKS}
ALIASES.update({'psalm': 'Psalms', 'song of songs': 'Song of Solomon', 'revelations': 'Revelation'})
REF_LINE = re.compile(r'^\s*\*\*\s*((?:[1-3]\s*)?[A-Za-z][A-Za-z ]+?)\.?\s+(\d+)\s*[:.]\s*(\d+)'
                      r'(?:\s*[-–—]\s*(\d+))?((?:\s*,\s*\d+(?:\s*[-–]\s*\d+)?)*)\s*\*\*\s*(?:KJV)?\s*$', re.I)
ITALIC = re.compile(r'^\s*(?:\.\.\.|…)?\s*\*(?!\*)')


def load_kjv():
    os.makedirs(CACHE, exist_ok=True)
    verses = {}
    for book in BOOKS:
        path = os.path.join(CACHE, slug(book) + '.json')
        if not os.path.exists(path):
            print('Downloading KJV text:', book)
            urllib.request.urlretrieve(KJV_URL.format(slug(book)), path)
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
        for c in data['chapters']:
            for v in c['verses']:
                verses[(book, int(c['chapter']), int(v['verse']))] = v['text']
    return verses


def words(s):
    return re.findall(r"[a-z]+", s.lower().replace('’', "'"))


def citations(text):
    """(reference line, quoted lines) pairs. The reference may sit above or below its quote."""
    lines = text.split('\n')
    found = []
    for i, line in enumerate(lines):
        m = REF_LINE.match(line)
        if not m:
            continue
        above = []
        for prev in reversed(lines[:i]):
            if not prev.strip():
                if above:
                    break
                continue
            if ITALIC.match(prev):
                above.insert(0, prev)
            else:
                break
        below = []
        for nxt in lines[i + 1:]:
            if not nxt.strip():
                if below:
                    break
                continue
            if ITALIC.match(nxt):
                below.append(nxt)
            else:
                break
        found.append((line, m, above, below, i > 0 and bool(ITALIC.match(lines[i - 1]))))
    # A post that ever puts a reference directly under a quote (no blank line) cites below throughout.
    below_style = any(touching for *_, touching in found)
    return [(line, m, above if below_style else below) for line, m, above, below, touching in found]


def label_verses(m):
    book = ALIASES.get(re.sub(r'\s+', ' ', m.group(1).strip().lower()))
    if not book:
        return None, []
    ch, v1 = int(m.group(2)), int(m.group(3))
    v2 = int(m.group(4) or v1)
    vs = list(range(v1, max(v1, v2) + 1)) if v2 >= v1 else list(range(v2, v1 + 1))
    for a, b in re.findall(r'(\d+)(?:\s*[-–]\s*(\d+))?', m.group(5) or ''):
        vs += list(range(int(a), int(b or a) + 1))
    return book, [(book, ch, v) for v in vs]


def check_references(src, kjv, approved):
    grams = defaultdict(set)
    for key, t in kjv.items():
        w = words(t)
        for i in range(max(1, len(w) - 3)):
            grams[' '.join(w[i:i + 4])].add(key)
    wrong, not_kjv = [], []
    for book, chs in src.items():
        for ch, passes in chs.items():
            for s in passes:
                for p in s['posts']:
                    for line, m, quote in citations(p['text']):
                        if not quote:
                            continue
                        lbook, keys = label_verses(m)
                        if not lbook:
                            continue
                        qw = words(' '.join(quote))
                        if len(qw) < 6:
                            continue
                        kw = words(' '.join(kjv.get(k, '') for k in keys))
                        sm = SequenceMatcher(None, qw, kw, autojunk=False)
                        if kw and sum(b.size for b in sm.get_matching_blocks()) / len(qw) >= 0.6:
                            continue
                        hits = Counter()
                        for i in range(max(1, len(qw) - 3)):
                            for k in grams.get(' '.join(qw[i:i + 4]), ()):
                                hits[k] += 1
                        n_grams = max(1, len(qw) - 3)
                        by_chapter = Counter()
                        for (b, c, v), n in hits.items():
                            by_chapter[(b, c)] += n
                        where = {'book': book, 'chapter': ch, 'id': p['id'],
                                 'link': s['link'].rsplit('/', 1)[0] + '/' + str(p['id']),
                                 'label': line.strip(), 'quote': ' '.join(quote).replace('*', '').strip()}
                        if not by_chapter or by_chapter.most_common(1)[0][1] / n_grams < 0.5:
                            not_kjv.append(where)
                            continue
                        (b, c), _ = by_chapter.most_common(1)[0]
                        # the run of neighboring verses around the best match that the quote really covers
                        per_v = {v: n for (bb, cc, v), n in hits.items() if (bb, cc) == (b, c)}
                        top = max(per_v, key=per_v.get)
                        strong = {v for v, n in per_v.items() if n >= max(2, per_v[top] * 0.2)}
                        lo = hi = top
                        while lo - 1 in strong:
                            lo -= 1
                        while hi + 1 in strong:
                            hi += 1
                        vs = [lo, hi]
                        name = m.group(1).strip() if b == lbook else ('Psalm' if b == 'Psalms' and len(vs) == 1 else b)
                        new = f'{name} {c}:{vs[0]}' + (f'-{vs[-1]}' if vs[-1] != vs[0] else '')
                        old_inner = line.strip().strip('*').strip()
                        if new == old_inner or str(p['id']) in approved and any(
                                fx['find'] == line.strip() for fx in approved[str(p['id'])]):
                            continue
                        where.update(find=line.strip(), replace=f'**{new}**')
                        wrong.append(where)
    return wrong, not_kjv


WHOLE_LINE = re.compile(r'^\s*(?:\.\.\.|…)?\s*(\*\*?)(?!\s)[^*]+(?<!\s)\1[\s.,;:…]*$')


def check_wording(src, kjv):
    """Quoted blocks (lines wholly in italics or bold) whose wording isn't found in the KJV:
    a modern version pasted by mistake, or a quote from a non-scripture source."""
    grams = set()
    for t in kjv.values():
        w = words(t)
        grams.update(' '.join(w[i:i + 4]) for i in range(max(1, len(w) - 3)))
    out, seen = [], set()
    for book, chs in src.items():
        for ch, passes in chs.items():
            for s in passes:
                for p in s['posts']:
                    if p['id'] in seen or p['kind'] == 'scripture':
                        continue
                    seen.add(p['id'])
                    for block in re.split(r'\n\s*\n', p['text']):
                        lines = [l for l in block.split('\n') if l.strip()]
                        quote = [l for l in lines if WHOLE_LINE.match(l) and not REF_LINE.match(l)]
                        w = words(' '.join(quote))
                        if len(w) < 10:
                            continue
                        g = [' '.join(w[i:i + 4]) for i in range(len(w) - 3)]
                        if sum(x in grams for x in g) / len(g) < 0.5:
                            label = next((l.strip() for l in lines if REF_LINE.match(l)), '(no reference)')
                            out.append({'book': book, 'chapter': ch, 'id': p['id'], 'label': label,
                                        'link': s['link'].rsplit('/', 1)[0] + '/' + str(p['id']),
                                        'quote': ' '.join(quote).replace('*', '').strip()})
    return out


def check_typos(src, kjv):
    try:
        from spellchecker import SpellChecker
    except ImportError:
        return None
    sp = SpellChecker(distance=1)
    known = Counter()
    for t in kjv.values():
        known.update(words(t))
    seen, where = Counter(), {}
    for book, chs in src.items():
        for ch, passes in chs.items():
            for s in passes:
                for p in s['posts']:
                    if p['kind'] != 'study':
                        continue
                    for line in p['text'].split('\n'):
                        if ITALIC.match(line):          # scripture is never touched
                            continue
                        t = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', line)
                        t = re.sub(r'https?://\S+', '', t)
                        for w in re.findall(r"(?<![\w@#'’])[a-z]{3,}(?![\w'’])", t):
                            seen[w] += 1
                            where.setdefault(w, (book, ch, p['id'], s['link'], line.strip()))
    rare = [w for w, n in seen.items() if n <= 2 and w not in known]
    out = []
    for w in sorted(sp.unknown(rare)):
        fix = sp.correction(w)
        if fix and fix != w and (fix in known or sp.word_usage_frequency(fix) > 1e-6):
            out.append((w, fix, where[w]))
    return out


def main():
    with open(SRC, encoding='utf-8') as f:
        src = json.load(f)
    approved = load_corrections()
    apply_corrections(src, approved)            # only look at what's still wrong
    kjv = load_kjv()
    wrong, _ = check_references(src, kjv, approved)
    not_kjv = check_wording(src, kjv)
    typos = check_typos(src, kjv)

    L = ['# Proposed corrections\n',
         '\nNothing here is applied yet. To approve a fix, copy its JSON line into `review/corrections.json` '
         'under the post id, then rerun `python3 tools/clean_studies.py`. Scripture wording is never changed; '
         'only reference labels and commentary spelling are proposed.\n',
         '\nRegenerated by `python3 tools/find_corrections.py`; don\'t edit it.\n',
         f'\n## Verse references that don\'t match their quote ({len(wrong)})\n']
    for w in wrong:
        L.append(f"\n- {w['book']} {w['chapter']} · [post {w['id']}]({w['link']}) · `{w['find']}` → `{w['replace']}`\n"
                 f"  > {w['quote'][:160]}\n\n"
                 f"  `\"{w['id']}\": [{{\"find\": {json.dumps(w['find'])}, \"replace\": {json.dumps(w['replace'])}}}]`\n")
    L.append(f'\n## Quotes that aren\'t KJV wording ({len(not_kjv)})\n\n'
             'Scripture pasted from a modern version should be replaced with the KJV text in corrections.json. '
             'Quotes from other writers (historians, hymns, commentaries) belong here and stay as they are.\n')
    for w in not_kjv:
        L.append(f"\n- {w['book']} {w['chapter']} · [post {w['id']}]({w['link']}) · `{w['label']}`\n"
                 f"  > {w['quote'][:160]}\n")
    if typos is None:
        L.append('\n## Spelling\n\nNot checked: install pyspellchecker (`pip install pyspellchecker`) to include it.\n')
    else:
        L.append(f'\n## Possible spelling mistakes in the commentary ({len(typos)})\n\n'
                 'Words not in the KJV or an English dictionary, with the nearest real word. Many will be names, '
                 'slang or deliberate spellings; approve only the real typos.\n')
        for w, fix, (book, ch, pid, link, line) in typos:
            ctx = re.sub(r'\s+', ' ', line.replace('*', ''))
            i = ctx.lower().find(w)
            ctx = ('…' if i > 50 else '') + ctx[max(0, i - 50):i + len(w) + 50] + ('…' if i + len(w) + 50 < len(ctx) else '')
            L.append(f"- {book} {ch} · [post {pid}]({link.rsplit('/', 1)[0]}/{pid}) · **{w}** → {fix} · {ctx}\n")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(''.join(L))
    print(f'References to fix: {len(wrong)}; non-KJV quotes: {len(not_kjv)}; '
          f"possible typos: {'not checked' if typos is None else len(typos)}")
    print('Written to', os.path.relpath(OUT, ROOT))


if __name__ == '__main__':
    main()
