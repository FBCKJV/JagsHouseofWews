#!/usr/bin/env python3
"""Search and verse index: studies/data/books + review/standalone.json + lessons -> studies/data/search.json.

Run after tools/clean_studies.py and tools/build_lessons.py:

    python3 tools/build_search.py

One entry per chapter study (each pass), standalone teaching and lesson, with its plain text for the
word search. Every scripture reference found in an entry ("Romans 10:9", "**John 3:16-18**",
"1 Peter 3:18, 21") is indexed to the verse, so a search for a verse lists everywhere it is taught.
No third-party packages needed.
"""
import html, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'studies', 'data')
OUT = os.path.join(DATA, 'search.json')

INDEX = json.load(open(os.path.join(DATA, 'books.json'), encoding='utf-8'))
BOOKS = [b['book'] for b in INDEX['books']]
CHAPTERS = {b['book']: b['chapters'] for b in INDEX['books']}
ALIASES = {'Psalm': 'Psalms', 'Mathew': 'Matthew', 'Zachariah': 'Zechariah', 'Php': 'Philippians',
           'Phil': 'Philippians', 'Eph': 'Ephesians', 'Col': 'Colossians', 'Hebrew': 'Hebrews', 'Tutus': 'Titus',
           'Rom': 'Romans', 'Gen': 'Genesis', 'Matt': 'Matthew', 'Rev': 'Revelation', 'Heb': 'Hebrews',
           'Song of Songs': 'Song of Solomon'}
NAMES = sorted(BOOKS + list(ALIASES), key=len, reverse=True)
REF = re.compile(r'\b(' + '|'.join(re.escape(n) for n in NAMES) + r')\.?\s+(\d{1,3}):(\d{1,3})((?:\s*[-–—]\s*\d{1,3})?(?:\s*,\s*\d{1,3}(?:\s*[-–—]\s*\d{1,3})?)*)')


def refs(text):
    """Every verse cited in the text, as "Book ch:v"."""
    out = set()
    for m in REF.finditer(text.replace('*', '')):
        book = ALIASES.get(m.group(1), m.group(1))
        ch, first = int(m.group(2)), int(m.group(3))
        if book not in CHAPTERS or not 1 <= ch <= CHAPTERS[book]:
            continue
        spans = [(first, first)]
        rest = m.group(4) or ''
        r = re.match(r'\s*[-–—]\s*(\d{1,3})', rest)
        if r:
            spans[0] = (first, int(r.group(1)))
            rest = rest[r.end():]
        for part in re.findall(r',\s*(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?', rest):
            a = int(part[0]); spans.append((a, int(part[1]) if part[1] else a))
        for a, b in spans:
            if a <= b <= a + 40:
                out.update(f'{book} {ch}:{v}' for v in range(a, b + 1))
    return out


def plain(text):
    text = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', text)
    text = re.sub(r'https?://\S+', '', text)
    return re.sub(r'\s+', ' ', text.replace('*', '')).strip()


def html_text(s):
    s = re.sub(r'<(script|style)\b.*?</\1>', ' ', s, flags=re.S)
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s))).strip()


def main():
    items, verses = [], {}

    def add(kind, href, title, date, text, extra_refs=()):
        i = len(items)
        items.append([kind, href, title, date, plain(text)])
        for r in refs(text) | set(extra_refs):
            verses.setdefault(r, []).append(i)

    # chapter studies: one entry per study of a chapter, in the app's tab order (newest first)
    for b in INDEX['books']:
        data = json.load(open(os.path.join(DATA, 'books', b['slug'] + '.json'), encoding='utf-8'))
        for ch, e in sorted(data['studies'].items(), key=lambda x: int(x[0])):
            main_s = e.get('main') if e.get('status') != 'with' else None
            studies = sorted(([main_s] if main_s else []) + e.get('others', []), key=lambda s: s['date'], reverse=True)
            home = studies.index(main_s) if main_s in studies else 0
            for k, s in enumerate(studies):
                text = '\n\n'.join(p['text'] for p in s['posts'] if p['kind'] != 'scripture' and p.get('text'))
                if not text.strip():
                    continue
                href = f"#{b['slug']}-{ch}" + ('' if k == home else f'.{k + 1}')
                label = 'Gathered' if s.get('label') else ('Series study' if s['series'] else 'Earlier study')
                add('s', href, f"{b['book']} {ch}", s['date'][:10], text)
                items[-1].append(label)

    # standalone teachings, filed under their first doctrine topic
    st = json.load(open(os.path.join(ROOT, 'review', 'standalone.json'), encoding='utf-8'))['teachings']
    for t in st:
        if not t.get('topics'):
            continue
        extra = refs(' '.join(t.get('verses', [])))
        add('t', f"#doctrine-{t['topics'][0]}~{t['id']}", t['title'], t['date'][:10], t['text'], extra)

    # lessons: title, summary, and the words on the slides or in the notes
    lib = json.load(open(os.path.join(DATA, 'lessons.json'), encoding='utf-8'))
    for l in lib['lessons']:
        body = [l['title'], l.get('summary', '')]
        for p in l['parts']:
            path = os.path.join(ROOT, 'studies', p['href']) if p['kind'] == 'notes' else \
                   os.path.normpath(os.path.join(ROOT, 'studies', p['href']))
            if p['kind'] in ('notes', 'page') and os.path.isfile(path):
                body.append(html_text(open(path, encoding='utf-8').read()))
        extra = refs(' '.join(l.get('verses', [])))
        add('l', f"#lesson-{l['id']}", l['title'], '', '\n'.join(body), extra)

    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump({'items': items, 'verses': verses}, f, ensure_ascii=False, separators=(',', ':'))
    kinds = {k: sum(1 for i in items if i[0] == k) for k in 'stl'}
    print(f"Search: {kinds['s']} studies, {kinds['t']} teachings, {kinds['l']} lessons; "
          f"{len(verses)} verses indexed; {os.path.getsize(OUT) // 1024} KB")


if __name__ == '__main__':
    main()
