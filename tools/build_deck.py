#!/usr/bin/env python3
"""Build a lesson slide deck from a plain-text source, in the style of the Genesis decks.

    python3 tools/build_deck.py lessons/src/genesis-7-the-flood.deck     # one deck
    python3 tools/build_deck.py                                          # every deck in lessons/src

The look, the KJV verse pop-ups and the slide controls live in tools/deck/template.html, so every
deck is the same and a fix there reaches all of them on the next build. Every passage and pop-up
is filled in from the King James text (tools/find_corrections.load_kjv), never typed by hand.

Source format, one element per line (blank lines are ignored, # starts a comment):

  title: Genesis 7 – The Flood                 page title
  description: A study in Genesis 7 …          one sentence for search engines and link previews
  output: lessons/genesis/genesis-7-the-flood.html

  === Into the ark                             a section: shown in the bar and the contents
  --- Come thou and all thy house              a slide (add " [title]" for a centered title slide)

  overline: A study in Genesis 7               small capitals above the heading (title slides)
  heading: The Flood                           the big heading on a title slide (default: the slide title)
  sub: …                                       subtitle
  lead: …                                      opening paragraph, larger
  p: …                                         paragraph
  center: …                                    centered paragraph
  note: …                                      small centered note
  scripture: Genesis 7:1-5 | mark: thee have I seen righteous; Noah only remained alive
                                               KJV passage with verse numbers; "mark" highlights words
  big: Romans 6:23 | mark: …                   a short KJV passage, large
  quote: words | Cite                          a quotation that is not the KJV text itself
  - …                                          bullet points (consecutive lines make one list)
  panel: Title | text                          a card; consecutive panels sit side by side
  panel-warn: Title | text                     the red-edged card (error, judgment)
  callout: …                                   a boxed note ("callout-honest:" for the plain box)
  stat: 40 | days and nights of rain           big number with a label; consecutive stats make a row
  step: 1209 | The Albigensian Crusade …       a dated entry; consecutive steps make a vertical timeline
  tile: 930 | Adam dies                        a short boxed entry; consecutive tiles sit side by side
  point: Title | text                          numbered summary points (closing slides)
  refs: John 3:16; Romans 10:13                a row of verse buttons

Inline, in any text:  [[John 3:16]] or [[John 3:16|label]] is a tap-to-read verse, {Lord} is
LORD in small capitals, **bold**, *italic*.
"""
import glob, html, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import find_corrections as fc  # noqa: E402

KJV = fc.load_kjv()
BOOK_NAMES = sorted({b for b, _, _ in KJV}, key=len, reverse=True)
SHORT = {'Gen': 'Genesis', 'Ex': 'Exodus', 'Exod': 'Exodus', 'Lev': 'Leviticus', 'Num': 'Numbers', 'Deut': 'Deuteronomy',
         'Josh': 'Joshua', 'Judg': 'Judges', '1 Sam': '1 Samuel', '2 Sam': '2 Samuel', '1 Kgs': '1 Kings', '2 Kgs': '2 Kings',
         'Ps': 'Psalms', 'Psalm': 'Psalms', 'Prov': 'Proverbs', 'Eccl': 'Ecclesiastes', 'Isa': 'Isaiah', 'Jer': 'Jeremiah',
         'Ezek': 'Ezekiel', 'Dan': 'Daniel', 'Hos': 'Hosea', 'Zech': 'Zechariah', 'Mal': 'Malachi', 'Matt': 'Matthew',
         'Rom': 'Romans', '1 Cor': '1 Corinthians', '2 Cor': '2 Corinthians', 'Gal': 'Galatians', 'Eph': 'Ephesians',
         'Phil': 'Philippians', 'Col': 'Colossians', '1 Thess': '1 Thessalonians', '2 Thess': '2 Thessalonians',
         '1 Tim': '1 Timothy', '2 Tim': '2 Timothy', 'Heb': 'Hebrews', 'Jas': 'James', '1 Pet': '1 Peter', '2 Pet': '2 Peter',
         'Rev': 'Revelation'}


def parse_ref(ref):
    """'Rom 10:9-10' -> ('Romans', 10, 9, 10). Jude may be written 'Jude 3'."""
    ref = ref.strip().replace('–', '-')
    m = re.match(r'^(.*?\S)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$', ref)
    if not m:
        raise SystemExit(f'Not a reference: {ref!r}')
    book = SHORT.get(m.group(1), m.group(1))
    if book not in BOOK_NAMES:
        raise SystemExit(f'Unknown book in {ref!r}')
    if m.group(3) is None:                      # Jude 3, Obadiah 4 …
        ch, a = 1, int(m.group(2)); b = a
    else:
        ch, a = int(m.group(2)), int(m.group(3)); b = int(m.group(4) or a)
    for v in range(a, b + 1):
        if (book, ch, v) not in KJV:
            raise SystemExit(f'No such verse: {book} {ch}:{v} (in {ref!r})')
    return book, ch, a, b


def key_of(ref):
    book, ch, a, b = parse_ref(ref)
    return f'{book} {ch}:{a}' + (f'-{b}' if b > a else '')


def label_of(ref):
    book, ch, a, b = parse_ref(ref)
    book = 'Psalm' if book == 'Psalms' else book
    cv = f'{a}' + (f'–{b}' if b > a else '') if book in ('Jude', 'Obadiah', 'Philemon', '2 John', '3 John') \
        else f'{ch}:{a}' + (f'–{b}' if b > a else '')
    return f'{book} {cv}'


def verses(ref):
    book, ch, a, b = parse_ref(ref)
    return [(v, KJV[(book, ch, v)]) for v in range(a, b + 1)]


USED = {}


def esc(s):
    return html.escape(s, quote=False)


def inline(s):
    """Escape, then **bold**, *italic*, {Lord}, and [[verse]] buttons."""
    out, last = [], 0
    for m in re.finditer(r'\[\[([^\]|]+)(?:\|([^\]]+))?\]\]', s):
        out.append(fmt(esc(s[last:m.start()])))
        k = key_of(m.group(1)); USED[k] = verses(m.group(1))
        out.append(f'<button class="ref" data-v="{esc(k)}">{esc(m.group(2) or label_of(m.group(1)))}</button>')
        last = m.end()
    out.append(fmt(esc(s[last:])))
    return ''.join(out)


def fmt(s):
    s = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', s)
    s = re.sub(r'\*(.+?)\*', r'<em>\1</em>', s)
    return s.replace('{Lord}', '<span class="lord">Lord</span>').replace('{God}', '<span class="lord">God</span>')


def kjv_html(text, marks):
    t = esc(text)
    for m in marks:
        if esc(m) in t:
            t = t.replace(esc(m), f'<mark>{esc(m)}</mark>', 1)
    return re.sub(r'\bLORD\b', '<span class="lord">Lord</span>', re.sub(r'\bGOD\b', '<span class="lord">God</span>', t))


def passage(arg, big):
    ref, _, rest = arg.partition('|')
    marks = [x.strip() for x in rest.split(':', 1)[1].split(';')] if rest.strip().startswith('mark') else []
    vs = verses(ref)
    joined = ' '.join(f'<sup>{n}</sup>{kjv_html(t, marks)}' for n, t in vs) if not big \
        else ' '.join(kjv_html(t, marks) for _, t in vs)
    missing = [m for m in marks if m not in ' '.join(t for _, t in vs)]
    if missing:
        raise SystemExit(f'{ref}: marked words not in the verse: {missing}')
    cls = 'big-verse' if big else 'scripture'
    style = '' if big else ' style="font-style:italic"'
    return f'<blockquote class="{cls}"{style}>{joined}<cite>{esc(label_of(ref))}</cite></blockquote>'


def build(src):
    meta, sections, slide = {}, None, None
    slides = []
    for raw in open(src, encoding='utf-8'):
        line = raw.rstrip('\n')
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        if line.startswith('=== '):
            sections = line[4:].strip(); continue
        if line.startswith('--- '):
            t = line[4:].strip(); kind = 'title' if t.endswith('[title]') else 'page'
            slide = {'section': sections or '', 'title': t.replace('[title]', '').strip(), 'kind': kind, 'items': []}
            slides.append(slide); continue
        if slide is None:
            k, _, v = line.partition(':'); meta[k.strip()] = v.strip(); continue
        if line.startswith('- '):
            slide['items'].append(('-', line[2:].strip())); continue
        k, _, v = line.partition(':')
        slide['items'].append((k.strip(), v.strip()))

    body = []
    for i, s in enumerate(slides, 1):
        title_page = s['kind'] == 'title'
        parts, j, items = [], 0, s['items']
        heading = next((v for k, v in items if k == 'heading'), s['title'])
        if title_page:
            ov = next((v for k, v in items if k == 'overline'), None)
            if ov: parts.append(f'<div class="overline">{inline(ov)}</div>')
            parts.append(f'<h1>{inline(heading)}</h1>')
        else:
            parts.append(f'<h2>{inline(heading)}</h2>')
        while j < len(items):
            k, v = items[j]
            group = [v]
            same = lambda a, b: a == b or {a, b} <= {'panel', 'panel-warn'}   # cards of both kinds share a row
            kinds = [k]
            while j + 1 < len(items) and same(items[j + 1][0], k) and k in ('-', 'panel', 'panel-warn', 'stat', 'step', 'tile', 'point'):
                j += 1; group.append(items[j][1]); kinds.append(items[j][0])
            if k in ('overline', 'heading'):
                pass
            elif k == 'sub':
                parts.append(f'<p class="sub">{inline(v)}</p>')
            elif k == 'lead': parts.append(f'<p class="lead">{inline(v)}</p>')
            elif k == 'p': parts.append(f'<p>{inline(v)}</p>')
            elif k == 'center': parts.append(f'<p class="center">{inline(v)}</p>')
            elif k == 'note': parts.append(f'<p class="sub center">{inline(v)}</p>')
            elif k == 'hint': parts.append(f'<p class="hint">{inline(v)}</p>')
            elif k == 'scripture': parts.append(passage(v, False))
            elif k == 'big': parts.append(passage(v, True))
            elif k == 'quote':
                text, _, cite = v.partition('|')
                parts.append(f'<blockquote>{inline(text.strip())}<cite>{inline(cite.strip())}</cite></blockquote>')
            elif k == '-':
                parts.append('<ul class="marks">' + ''.join(f'<li>{inline(x)}</li>' for x in group) + '</ul>')
            elif k in ('panel', 'panel-warn'):
                cards = []
                for kind, x in zip(kinds, group):
                    cls = 'panel cain' if kind == 'panel-warn' else 'panel believers'
                    h, _, t = x.partition('|')
                    cards.append(f'<div class="{cls}"><h3>{inline(h.strip())}</h3><p>{inline(t.strip())}</p></div>')
                wrap = 'cols-3' if len(cards) == 3 else 'cols'
                for n in range(0, len(cards), 3 if len(cards) == 3 else 2):
                    parts.append(f'<div class="{wrap}">' + ''.join(cards[n:n + (3 if len(cards) == 3 else 2)]) + '</div>')
            elif k in ('callout', 'callout-honest'):
                parts.append(f'<div class="callout{" honest" if k == "callout-honest" else ""}"><p>{inline(v)}</p></div>')
            elif k == 'stat':
                parts.append('<div class="dims">' + ''.join(
                    f'<div><span class="n">{inline(a.strip())}</span><span class="lbl">{inline(b.strip())}</span></div>'
                    for a, _, b in (x.partition('|') for x in group)) + '</div>')
            elif k == 'step':
                parts.append('<div class="steps">' + ''.join(
                    f'<div class="st"><span class="when">{inline(a.strip())}</span><div>{inline(b.strip())}</div></div>'
                    for a, _, b in (x.partition('|') for x in group)) + '</div>')
            elif k == 'tile':
                parts.append('<div class="timeline">' + ''.join(
                    f'<div><span class="n">{inline(a.strip())}</span><span class="lbl">{inline(b.strip())}</span></div>'
                    for a, _, b in (x.partition('|') for x in group)) + '</div>')
            elif k == 'point':
                parts.append('<div style="text-align:left;max-width:640px;margin:0 auto"><ol class="order">' + ''.join(
                    f'<li><strong>{inline(a.strip())}</strong>{inline(b.strip())}</li>'
                    for a, _, b in (x.partition('|') for x in group)) + '</ol></div>')
            elif k == 'refs':
                parts.append('<div class="refs center">' + ''.join(
                    inline(f'[[{r.strip()}]]') for r in v.split(';') if r.strip()) + '</div>')
            else:
                raise SystemExit(f'{src}: slide "{s["title"]}": unknown line "{k}:"')
            j += 1
        if title_page:   # the ornament goes after the heading block, before the body text
            at = next((n for n, x in enumerate(parts) if x.startswith(('<p class="hint"', '<p class="center"', '<p>', '<div style'))), len(parts))
            parts.insert(at, '<span class="fleuron">✦ ✦ ✦</span>')
        page = ('page title-page' + (' later' if i > 1 else '')) if title_page else 'page'
        body.append(f'<!-- {i} -->\n<section class="slide" data-section="{html.escape(s["section"])}" '
                    f'data-title="{html.escape(s["title"])}">\n  <div class="{page}">\n    '
                    + '\n    '.join(parts) + '\n  </div>\n</section>\n')

    tpl = open(os.path.join(ROOT, 'tools', 'deck', 'template.html'), encoding='utf-8').read()
    vmap = '{\n' + ',\n'.join(f'  {json.dumps(k)}:' + json.dumps([[n, t] for n, t in v], ensure_ascii=False)
                              for k, v in sorted(USED.items())) + '\n}'
    out = (tpl.replace('{{TITLE}}', html.escape(meta['title'], quote=False))
              .replace('{{DESCRIPTION}}', html.escape(meta.get('description', ''), quote=True))
              .replace('{{SLIDES}}', '\n'.join(body)).replace('{{VERSES}}', vmap))
    dest = os.path.join(ROOT, meta['output'])
    with open(dest, 'w', encoding='utf-8') as f:
        f.write(out)
    print(f'{meta["output"]}: {len(slides)} slides, {len(USED)} verse pop-ups')
    USED.clear()


if __name__ == '__main__':
    for src in sys.argv[1:] or sorted(glob.glob(os.path.join(ROOT, 'lessons', 'src', '*.deck'))):
        build(src)
