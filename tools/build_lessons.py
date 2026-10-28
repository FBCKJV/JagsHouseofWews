#!/usr/bin/env python3
"""Lessons & pictures: review/lessons.json -> studies/data/lessons.json.

review/lessons.json is the catalogue, edited by hand: the class lessons, slide decks, notes and
handouts from the Classroom folder, and the teaching pictures, each filed under doctrine topics and
the chapters they teach on. This checks every file and topic it names and writes the app's index.

    python3 tools/build_lessons.py
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'review', 'lessons.json')
OUT = os.path.join(ROOT, 'studies', 'data', 'lessons.json')


def load(path):
    with open(os.path.join(ROOT, path), encoding='utf-8') as f:
        return json.load(f)


def main():
    cat = load('review/lessons.json')
    topics = {t['id'] for t in load('review/topics.json')['topics']}
    books = {b['book']: b for b in load('studies/data/books.json')['books']}
    shelves = {s['id'] for s in cat['shelves']}
    problems = []

    def chapter(ref, where):
        m = re.match(r'^(.*\S)\s+(\d+)$', ref.strip())
        name = m and (m.group(1).replace('Psalm', 'Psalms') if m.group(1) == 'Psalm' else m.group(1))
        b = m and books.get(name)
        if not b or not 1 <= int(m.group(2)) <= b['chapters']:
            problems.append(f'{where}: no such chapter "{ref}"')
            return None
        return {'book': b['book'], 'slug': b['slug'], 'ch': int(m.group(2))}

    def check_topics(ids, where):
        for t in ids:
            if t not in topics:
                problems.append(f'{where}: unknown topic "{t}"')
        return [t for t in ids if t in topics]

    def exists(path, where):
        if not os.path.isfile(os.path.join(ROOT, path)):
            problems.append(f'{where}: missing file {path}')

    lessons, seen = [], set()
    for x in cat['lessons']:
        where = 'lesson ' + x['id']
        if x['id'] in seen:
            problems.append(f'{where}: id used twice')
        seen.add(x['id'])
        if x['shelf'] not in shelves:
            problems.append(f'{where}: unknown shelf "{x["shelf"]}"')
        parts = []
        for p in x['parts']:
            exists(p['file'], where)
            if p.get('label') == 'asset':
                continue
            kind = 'notes' if p['file'].startswith('studies/data/notes/') else \
                   'pdf' if p['file'].endswith('.pdf') else 'page'
            # the app lives in studies/, so notes load from data/… and pages open from ../
            href = p['file'][len('studies/'):] if kind == 'notes' else '../' + p['file']
            parts.append({'label': p['label'], 'kind': kind, 'href': href})
        lessons.append({
            'id': x['id'], 'title': x['title'], 'shelf': x['shelf'], 'order': x.get('order', 0),
            'summary': x.get('summary', ''), 'by': x.get('by'),
            'topics': check_topics(x.get('topics', []), where),
            'chapters': [c for c in (chapter(r, where) for r in x.get('chapters', [])) if c],
            'verses': x.get('verses', []), 'parts': parts})

    pictures = []
    for x in cat.get('pictures', []):
        where = 'picture ' + x['id']
        exists(x['file'], where)
        pictures.append({'id': x['id'], 'title': x['title'], 'alt': x.get('alt', ''),
                         'src': '../' + x['file'], 'w': x.get('w'), 'h': x.get('h'),
                         'topics': check_topics(x.get('topics', []), where),
                         'chapters': [c for c in (chapter(r, where) for r in x.get('chapters', [])) if c],
                         'verses': x.get('verses', [])})

    order = {s['id']: i for i, s in enumerate(cat['shelves'])}
    lessons.sort(key=lambda l: (order.get(l['shelf'], 99), l['order'], l['title'].lower()))
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump({'shelves': cat['shelves'], 'lessons': lessons, 'pictures': pictures},
                  f, ensure_ascii=False, separators=(',', ':'))

    print(f'Lessons: {len(lessons)} on {len(cat["shelves"])} shelves; pictures: {len(pictures)}')
    for p in problems:
        print('  !', p)
    return 1 if problems else 0


if __name__ == '__main__':
    code = main()
    import build_search   # lessons are in the search index too
    build_search.main()
    sys.exit(code)
