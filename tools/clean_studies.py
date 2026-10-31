#!/usr/bin/env python3
"""
clean_studies.py - turn the Telegram export into the data the Chapter Studies app reads.

Usage (from the repo root):
    python3 tools/clean_studies.py

Reads (never edits):
  telegram_chapter_studies/chapter_studies.json   output of extract_studies.py
  review/decisions.json                            your keep/drop choices (created if missing)
  review/corrections.json                          approved fixes: wrong verse labels, typos
  review/topics.json                               doctrine topics and the teachings filed under each
  review/worldly.json                              posts marked as mostly politics/news/argument/harsh words
  review/refile.json                               posts the export filed under the wrong chapter, and
                                                   commentary missing from the export (pasted in or read
                                                   from the public channel)
  review/standalone.json                           standalone teachings from the channel, filed by topic
Writes (regenerated on every run, don't hand-edit):
  studies/data/books.json          small index: every book and chapter with its status
  studies/data/books/<Book>.json   one cleaned file per book, loaded by the app on demand
  review/flagged.md                study posts that may not be teaching on the chapter
  studies/data/topics.json         doctrine topics with counts and themes
  studies/data/topics/<id>.json    the teachings filed under one topic
  review/topics_unsorted.md        teachings (verses chained from several books) not filed yet
  review/worldly.md                the worldly posts, by book, with your keep/drop choice so far

Choosing a chapter's study:
  series study   the newest series pass with commentary (the teaching improved over the years)
  with           series posted the chapter's text, its commentary is with a neighbor chapter
  earlier        no series study, but a one-off pass has >= MIN_CHARS of commentary in your own
                 words (quoted scripture and reference lines don't count)
  none           "Not yet studied" (scripture-only reposts are never shown as a study)
Other passes are listed under the main study, newest first, when they have >= MIN_CHARS of commentary.

decisions.json:
  "posts":   {"<post id>": "keep" | "drop"}    applies to any post, flagged or not
  "studies": {"<first post id>": "show" | "hide"}   overrides the MIN_CHARS rule for one pass
  "flagged_default": "drop" | "keep"           what happens to flagged posts you haven't decided yet

corrections.json:
  {"<post id>": [{"find": "**Isaiah 51:1**", "replace": "**Isaiah 58:1**"}, ...]}
  Exact text replacements, applied before anything else. A fix whose text is no longer in the
  post (after a re-export) is skipped and reported. tools/find_corrections.py proposes them.
No third-party packages needed.
"""
import json, os, re, sys
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'telegram_chapter_studies', 'chapter_studies.json')
DECISIONS = os.path.join(ROOT, 'review', 'decisions.json')
CORRECTIONS = os.path.join(ROOT, 'review', 'corrections.json')
TOPICS = os.path.join(ROOT, 'review', 'topics.json')
UNSORTED = os.path.join(ROOT, 'review', 'topics_unsorted.md')
WORLDLY = os.path.join(ROOT, 'review', 'worldly.json')
REFILE = os.path.join(ROOT, 'review', 'refile.json')
STANDALONE = os.path.join(ROOT, 'review', 'standalone.json')
WORLDLY_MD = os.path.join(ROOT, 'review', 'worldly.md')
FLAGGED = os.path.join(ROOT, 'review', 'flagged.md')
OUT = os.path.join(ROOT, 'studies', 'data')
MIN_CHARS = 500

BOOKS = ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
         "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
         "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel",
         "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
         "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
         "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon",
         "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"]
CHAPTERS = [50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29, 36, 10, 13, 10, 42, 150, 31, 12, 8, 66, 52, 5, 48, 12, 14,
            3, 9, 1, 4, 7, 3, 3, 3, 2, 14, 4, 28, 16, 24, 21, 28, 16, 16, 13, 6, 6, 4, 4, 5, 3, 6, 4, 3, 1, 13, 5, 5, 3,
            5, 1, 1, 1, 22]
OLD_TESTAMENT = set(BOOKS[:39])


def slug(book):
    return book.replace(' ', '')


# ---------- links ----------
# Raw Telegram / X / YouTube links are chatter, not teaching. A [titled](link) is left alone.
STRIP_HOSTS = r'(?:t\.me|telegram\.me|x\.com|twitter\.com|mobile\.twitter\.com|youtube\.com|m\.youtube\.com|youtu\.be)'
RAW_URL = re.compile(r'(?<!\]\()(?<![\w/])(?:https?://)?(?:www\.)?' + STRIP_HOSTS + r'/[^\s)\]]*', re.I)
ANY_URL = re.compile(r'(?<!\]\()https?://\S+|(?<![\w/.])(?:www\.)\S+', re.I)


# A line wholly in italics or bold is a quotation; a bold "Book 1:2" line is its reference.
QUOTE_LINE = re.compile(r'^\s*(?:\.\.\.|…)?\s*(\*\*?)(?!\s)[^*]+(?<!\s)\1[\s.,;:…]*$')
REF_ONLY = re.compile(r'^\s*\*\*[^*]*\d[^*]*\*\*\s*$')


def own_words(text):
    """Length of the commentary itself, leaving out quoted scripture and reference lines."""
    return sum(len(l) for l in text.split('\n') if l.strip() and not QUOTE_LINE.match(l) and not REF_ONLY.match(l))


TG_TITLED = re.compile(r'\[([^\]]+)\]\((?:https?://)?(?:www\.)?(?:t\.me|telegram\.me)/[^)]*\)', re.I)


def no_telegram(text):
    """The app carries no links to Telegram: a [titled](t.me link) keeps its words, a bare one is removed."""
    out = TG_TITLED.sub(r'\1', text)
    out = re.sub(r'(?:https?://)?(?:www\.)?(?:t\.me|telegram\.me)/[^\s)\]]*', '', out, flags=re.I)
    out = re.sub(r'\(\s*\)', '', out)
    out = re.sub(r'[ \t]+\n', '\n', out)
    return re.sub(r'[ \t]{2,}', ' ', out).strip()


def strip_links(text):
    out = RAW_URL.sub('', text)
    out = re.sub(r'[ \t]+\n', '\n', out)
    out = re.sub(r'\n{3,}', '\n\n', out)
    return out.strip()


# ---------- flagging ----------
BOOK_NAMES = '|'.join(re.escape(b) for b in BOOKS + ['Psalm', 'Song of Songs', 'Revelations'])
SCRIPTURE_REF = re.compile(r'\b(?:' + BOOK_NAMES + r')\s+\d+(?::\d+)?', re.I)
ITALIC_LINE = re.compile(r'^\s*\*[^*\n].*\*\s*$', re.M)
FAITH_WORDS = re.compile(
    r'\b(god|lord|jesus|christ|holy ghost|spirit|scripture|gospel|saved|salvation|sin|sins|faith|grace|righteous\w*|'
    r'prophe\w*|israel|church|heaven|hell|covenant|law|repent\w*|believ\w*|psalm\w*|amen|kjv|bible|verse|chapter|'
    r'doctrine|worship\w*|pray\w*|judgment|wicked|soul|apostle|disciples?|baptiz\w*|resurrection|messiah|sacrific\w*|'
    r'temple|priest\w*|king|david|moses|paul|peter|abraham|solomon|rapture|tribulation|rod|fool\w*|wisdom|'
    r'parents?|children|israelites?|tribes?)\b', re.I)

OFF_TOPIC = [
    ('politics or current events', re.compile(
        r'\b((?-i:Trump)|biden|obama|kamala|harris|desantis|election|elections|vote|voting|voters|democrats?|republicans?|'
        r'gop|liberals?|conservatives?|leftists?|maga|congress|senate|white house|supreme court|nationalism|'
        r'covid|vaccines?|vaxx?|mandates?|lockdowns?|pandemic|ukraine|zelensky|putin|nato|cnn|fox news|msm|'
        r'mainstream media|news ?cycle|headlines?|elon|musk|twitter|tweet|podcast|live ?stream|youtube|'
        r'chatgpt|fbi|cia|globalists?|wef|klaus schwab|nfl|super ?bowl)\b', re.I)),
    ('aimed at critics or other people', re.compile(
        r'(@\w{3,}|\bsome of you\b|\byou people\b|\bhaters?\b|\btrolls?\b|\bin before\b|\bcope\b|\bcope and seethe\b|'
        r'\bmy dms?\b|\bin the comments\b|\bsomeone (?:asked|said|told)\b|'
        r'\bcalled me\b|\bblocked\b|\bunsubscrib\w*|\bjust sayin\'?g?\b(?=[.!\s]*$))', re.I)),
    ('channel chatter', re.compile(
        r"(\bwill be posting\b|\bi'?ll (?:post|finish|continue|get to)\b|\bposting (?:on|the rest)\b|\bi owe you\b|"
        r"\bsorry\b|\btypo\b|\bre-?edit\w*|\bout of order\b|\bscroll up\b|\bstay with it\b|"
        r"\btomorrow\b|\bthis morning\b|\btonight\b|\bi wasn'?t done\b|\bmore to come\b|\bstay tuned\b|"
        r"\bthat was a lot\b|\bwe will study\b|\bnew to (?:christianity|this channel)\b)", re.I)),
    ('meme or joke', re.compile(r'(😂|🤣|😜|😆|🙄|💀|\blol\b|\blmao\b|\brofl\b|\bkek\b|\bmemes?\b|(?<!works )(?<!works-)\bbased\b(?!\s+(?:on|upon|off|in)\b)|\bbillions must die\b)', re.I)),
]


def teaching_score(text):
    refs = len(SCRIPTURE_REF.findall(text))
    quotes = len(ITALIC_LINE.findall(text))
    words = len(FAITH_WORDS.findall(text))
    return refs * 3 + quotes * 2 + words


def flag_reason(post, text_after_links):
    """One-line reason this study post may not be teaching on the chapter, or None."""
    raw = post['text']
    text = text_after_links
    if raw and not text and not post.get('media'):
        return 'bare link'
    plain = ANY_URL.sub('', text).strip()
    if ANY_URL.search(text) and len(plain) < 60 and teaching_score(plain) < 3:
        return 'bare link'
    if not text:
        return None
    score = teaching_score(text)
    for reason, pat in OFF_TOPIC:
        hits = pat.findall(text)
        if not hits:
            continue
        # Doctrinal application and cross-references stay: a post that is mostly teaching
        # can mention the news or the channel in passing without being flagged.
        if len(text) >= 600 and score >= 8:
            continue
        if score >= 6 and len(hits) == 1 and reason != 'aimed at critics or other people':
            continue
        # Channel chatter inside a real study post is just how a long study gets introduced or closed.
        if reason == 'channel chatter' and (len(text) >= 300 or score >= 6):
            continue
        # Crediting someone for a cross-reference is teaching, not a reply to them.
        if reason == 'aimed at critics or other people' and all(h.startswith('@') for h in hits) and score >= 6:
            continue
        hit = hits[0] if isinstance(hits[0], str) else hits[0][0]
        return f'{reason} ("{hit.strip()}")'
    # A short line on an image is its caption ("A map for the visually minded").
    if len(text) < 100 and score == 0 and not SCRIPTURE_REF.search(text) and not post.get('media'):
        return 'short aside with no teaching'
    return None


# ---------- main ----------
def load_decisions():
    if os.path.exists(DECISIONS):
        with open(DECISIONS, encoding='utf-8') as f:
            d = json.load(f)
    else:
        d = {}
    d.setdefault('flagged_default', 'drop')
    d.setdefault('worldly_default', 'drop')
    d.setdefault('posts', {})
    d.setdefault('studies', {})
    return d


def load_corrections():
    if not os.path.exists(CORRECTIONS):
        return {}
    with open(CORRECTIONS, encoding='utf-8') as f:
        return {str(k): v for k, v in json.load(f).items() if not k.startswith('_')}


def apply_corrections(src, corrections):
    """Apply approved find/replace fixes to post text in memory. Returns the fixes that no longer match."""
    posts = {str(p['id']): p for chs in src.values() for passes in chs.values() for s in passes for p in s['posts']}
    applied, missed = 0, []
    for pid, fixes in corrections.items():
        p = posts.get(pid)
        for fx in fixes:
            if p and fx['find'] in p['text']:
                p['text'] = p['text'].replace(fx['find'], fx['replace'])
                applied += 1
            else:
                missed.append((pid, fx['find']))
    return applied, missed


def load_topics():
    if not os.path.exists(TOPICS):
        return {'topics': [], 'posts': {}}
    with open(TOPICS, encoding='utf-8') as f:
        t = json.load(f)
    t.setdefault('topics', [])
    t['posts'] = {str(k): v for k, v in t.get('posts', {}).items()}
    return t


REF_BOOK = re.compile(r'^\s*\*\*\s*((?:[1-3]\s*)?[A-Za-z][A-Za-z ]+?)\.?\s+\d+\s*[:.]\s*\d+[^*]*\*\*\s*$')


def references(text):
    """The "**Book 1:2**" reference lines in a post, in order."""
    return [m.group(0).strip().strip('*').strip() for m in map(REF_BOOK.match, text.split('\n')) if m]


def is_teaching(text, book):
    """Verses chained from several books to build a point: 3+ references from 2+ other books,
    with at least 300 characters of the author's own words."""
    refs = [REF_BOOK.match(l).group(1).strip().lower() for l in text.split('\n') if REF_BOOK.match(l)]
    others = {r for r in refs if r.rstrip('s') != book.lower().rstrip('s')}
    return len(refs) >= 3 and len(others) >= 2 and own_words(text) >= 300


def write_topics(topics, posts_by_id):
    """Doctrine pages: one data file per topic, plus the list of teachings not filed yet."""
    os.makedirs(os.path.join(OUT, 'topics'), exist_ok=True)
    names = {t['id']: t['name'] for t in topics['topics']}
    filed = defaultdict(list)
    for pid, a in topics['posts'].items():
        hit = posts_by_id.get(pid)
        if not hit or a.get('teaching') is False:
            continue
        book, ch, study, p = hit
        for i, tid in enumerate(a.get('topics', [])):
            if tid in names:
                filed[tid].append({
                    'id': p['id'], 'title': a.get('title', ''), 'theme': a.get('theme', '') if i == 0 else '',
                    'summary': a.get('summary', ''), 'date': p['date'][:10], 'book': book, 'slug': slug(book),
                    'ch': ch,
                    'refs': references(p['text']), 'also': [t for t in a['topics'] if t != tid and t in names],
                    'text': no_telegram(p['text'])})
    # standalone teachings (not part of a chapter study): their own group under each topic
    standalone = json.load(open(STANDALONE, encoding='utf-8'))['teachings'] if os.path.exists(STANDALONE) else []
    for x in standalone:
        chs = []
        for ref in x.get('chapters', []):
            m = re.match(r'^(.*\S)\s+(\d+)$', ref)
            if m and m.group(1) in BOOKS:
                chs.append({'book': m.group(1), 'slug': slug(m.group(1)), 'ch': int(m.group(2))})
        for i, tid in enumerate(x.get('topics', [])):
            if tid in names:
                filed[tid].append({
                    'id': x['id'], 'title': x['title'], 'theme': 'Standalone teachings' if i == 0 else '',
                    'summary': x.get('summary', ''), 'date': x['date'][:10], 'book': None, 'slug': None, 'ch': None,
                    'chapters': chs, 'refs': references(x['text']) or x.get('verses', []),
                    'also': [t for t in x['topics'] if t != tid and t in names], 'text': no_telegram(x['text'])})
    index = []
    for t in topics['topics']:
        items = filed.get(t['id'], [])
        # group by theme (the topic's main teachings first), then newest first within a theme
        themes = Counter(x['theme'] for x in items if x['theme'])
        order = {th: i for i, (th, _) in enumerate(themes.most_common())}
        items.sort(key=lambda x: x['date'], reverse=True)          # newest first within a theme
        items.sort(key=lambda x: (x['theme'] == '', x['theme'] == 'Standalone teachings', order.get(x['theme'], 999)))
        with open(os.path.join(OUT, 'topics', t['id'] + '.json'), 'w', encoding='utf-8') as f:
            json.dump({'id': t['id'], 'name': t['name'], 'about': t.get('about', ''),
                       **({'timeline': t['timeline']} if t.get('timeline') else {}),
                       **({'chart': t['chart']} if t.get('chart') else {}), 'teachings': items},
                      f, ensure_ascii=False, separators=(',', ':'))
        index.append({'id': t['id'], 'name': t['name'], 'about': t.get('about', ''), 'count': len(items),
                      'themes': [th for th, _ in themes.most_common()]})
    with open(os.path.join(OUT, 'topics.json'), 'w', encoding='utf-8') as f:
        json.dump({'topics': index}, f, ensure_ascii=False, separators=(',', ':'))

    unsorted = [(book, ch, study, p) for pid, (book, ch, study, p) in posts_by_id.items()
                if p['kind'] == 'study' and pid not in topics['posts'] and is_teaching(p['text'], book)]
    L = ['# Teachings not filed under a topic yet\n',
         f'\n{len(unsorted)} posts chain verses from several books to build a point but aren\'t in '
         '`review/topics.json` yet. Add each under `"posts"` with its topics, theme, title and summary '
         '(or `"teaching": false` to leave it out), then rerun `python3 tools/clean_studies.py`.\n',
         '\nRegenerated on every run; don\'t edit it.\n\n']
    for book, ch, study, p in sorted(unsorted, key=lambda x: x[3]['date']):
        first = re.sub(r'\s+', ' ', re.sub(r'[*#]', '', p['text'])).strip()[:150]
        L.append(f"- `{p['id']}` · {p['date'][:10]} · {book} {ch} · {', '.join(references(p['text'])[:4])}\n  > {first}\n")
    with open(UNSORTED, 'w', encoding='utf-8') as f:
        f.write(''.join(L))
    return sum(len(v) for v in filed.values()), len(unsorted)


def load_worldly():
    if not os.path.exists(WORLDLY):
        return {}
    with open(WORLDLY, encoding='utf-8') as f:
        return {str(k): v for k, v in json.load(f).items() if not k.startswith('_')}


def write_worldly(posts_by_id, dec):
    """The list of posts marked worldly. With "worldly_default": "drop" in decisions.json they are
    left out of the app entirely; mark one "keep" under "posts" to bring it back."""
    marks = load_worldly()
    if not marks:
        return 0
    choice = {str(k): v for k, v in dec['posts'].items()}
    rows = defaultdict(list)
    for pid, note in marks.items():
        hit = posts_by_id.get(pid)
        if hit:
            rows[hit[0]].append((hit, note))
    shown = dec['worldly_default'] != 'drop'
    L = ['# Worldly posts\n',
         f'\n{sum(len(v) for v in rows.values())} study posts are mostly politics, news, an argument with someone, '
         'or harsh words. ' + ('They are shown in the app. To leave one out, mark it `"drop"`' if shown else
         'They are left out of the app entirely (`"worldly_default": "drop"` in `review/decisions.json`). '
         'To bring one back, mark it `"keep"`') + ' under `"posts"` in `review/decisions.json`, then rerun '
         '`python3 tools/clean_studies.py`.\n',
         '\nRegenerated on every run; edit `review/worldly.json` to change what is on it.\n']
    for book in BOOKS:
        if not rows.get(book):
            continue
        L.append(f'\n## {book}\n\n')
        for (b, ch, study, p), note in sorted(rows[book], key=lambda x: (int(x[0][1]), x[0][3]['date'])):
            link = study['link'].rsplit('/', 1)[0] + '/' + str(p['id'])
            excerpt = re.sub(r'\s+', ' ', p['text'].replace('*', '')).strip()[:150]
            L.append(f"- `{p['id']}` · {b} {ch} · {p['date'][:10]} · [post]({link}) · {note} · "
                     f"{('**' + choice[str(p['id'])] + '**') if str(p['id']) in choice else 'undecided'}\n  > {excerpt}\n")
    with open(WORLDLY_MD, 'w', encoding='utf-8') as f:
        f.write(''.join(L))
    return len(marks)


def start_id(study):
    if not study.get('link'):                  # a Drive study has no Telegram post: use its first post id
        return str(study['posts'][0]['id'])
    return study['link'].rstrip('/').rsplit('/', 1)[-1]


def verse_range(study):
    """'8:4-9' when the pass covers only part of the chapter, from its first scripture post's heading."""
    for p in study['posts']:
        if p['kind'] == 'scripture':
            first = p['text'].strip().split('\n', 1)[0].replace('*', '')
            m = re.search(r'(\d+:\s*\d+(?:\s*[-–—]\s*\d+)?)', first)
            return m.group(1).replace(' ', '') if m else None
    return None


def apply_refile(src):
    """Put posts where they belong (review/refile.json). Works on the loaded copy, never the export."""
    if not os.path.exists(REFILE):
        return 0
    with open(REFILE, encoding='utf-8') as f:
        rf = json.load(f)

    def split(ref):
        m = re.match(r'^(.*\S)\s+(\d+)$', ref)
        return m.group(1), m.group(2)

    def primary(ref, like=None):
        book, ch = split(ref)
        passes = src.setdefault(book, {}).setdefault(ch, [])
        s = next((x for x in passes if x.get('primary')), None)
        if s is None:                    # the chapter had no study at all: start one
            s = {'date': like['date'], 'series': like['series'], 'link': like['link'], 'study_chars': 0,
                 'posts': [], 'primary': True}
            passes.insert(0, s)
        return s

    def recount(s):
        s['study_chars'] = sum(own_words(p['text']) for p in s['posts'] if p['kind'] == 'study')

    n = 0
    for ref, target in rf.get('with', {}).items():
        primary(ref)['commentary_with'] = target
        n += 1
    for kind in ('copy', 'move'):
        for job in rf.get(kind, []):
            book, ch = split(job['from'])
            ids = set(job['posts'])
            for s in src.get(book, {}).get(ch, []):
                hits = [p for p in s['posts'] if p['id'] in ids]
                if not hits:
                    continue
                dest = primary(job['to'], like=s)
                dest['posts'] += [dict(p, kind='study') for p in hits if p['id'] not in {q['id'] for q in dest['posts']}]
                recount(dest)
                if kind == 'move':
                    s['posts'] = [p for p in s['posts'] if p['id'] not in ids]
                    recount(s)
                n += len(hits)
    for job in rf.get('attach', []):     # posts of a day's study the export left out (read from the channel)
        dest = primary(job['to'], like={'date': job['posts'][0]['date'][:10], 'series': True,
                                        'link': f"https://t.me/HouseOfWews2/{job['posts'][0]['id']}"})
        have = {p['id'] for p in dest['posts']}
        new = [{'id': x['id'], 'date': x['date'], 'kind': 'study', 'text': x['text'], 'added': True}
               for x in job['posts'] if x['id'] not in have]
        dest['posts'] = sorted(dest['posts'] + new, key=lambda p: (p['date'], str(p['id'])))
        recount(dest)
        n += len(new)
    for job in rf.get('passes', []):     # a whole pass the export missed, read from the public channel
        book, ch = split(job['to'])
        passes = src.setdefault(book, {}).setdefault(ch, [])
        first = job['posts'][0]
        if any(p['id'] == first['id'] for s in passes for p in s['posts']):
            continue
        study = {'date': first['date'][:10], 'series': False, 'link': f"https://t.me/HouseOfWews2/{first['id']}",
                 'study_chars': 0, 'primary': False,
                 # "label": teaching gathered from other studies; shown as a tab, never as the chapter's study
                 **({'label': job['label'], 'gathered': True} if job.get('label') else {}),
                 'posts': [{'id': x['id'], 'date': x['date'], 'kind': 'study', 'text': x['text'], 'added': True}
                           for x in job['posts']]}
        recount(study)
        passes.append(study)
        n += len(job['posts'])
    for job in rf.get('drive', []):      # a study the author wrote in Google Drive and announced for a chapter
        book, ch = split(job['to'])
        passes = src.setdefault(book, {}).setdefault(ch, [])
        pid = 'added-drive-' + job['id']
        if any(str(p['id']) == pid for s in passes for p in s['posts']):
            continue
        study = {'date': job['date'][:10], 'series': False, 'link': None, 'study_chars': 0, 'primary': False,
                 'title': job['title'], 'source': 'drive',
                 'posts': [{'id': pid, 'date': job['date'][:10] + 'T00:00', 'kind': 'study', 'text': job['text'], 'added': True}]}
        recount(study)
        passes.append(study)
        n += 1
    for i, job in enumerate(rf.get('add', [])):
        dest = primary(job['to'])
        pid = 'added-' + re.sub(r'\W+', '-', job['to'].lower()) + f'-{i}'
        if pid not in {str(p['id']) for p in dest['posts']}:
            dest['posts'].append({'id': pid, 'date': job['date'], 'kind': 'study', 'text': job['text'], 'added': True})
            recount(dest)
            n += 1
    return n


def main():
    with open(SRC, encoding='utf-8') as f:
        src = json.load(f)
    fixed, missed = apply_corrections(src, load_corrections())
    refiled = apply_refile(src)
    topics = load_topics()
    posts_by_id = {}                     # every post shown in the app: id -> (book, chapter, study, post)
    dec = load_decisions()
    worldly = load_worldly() if dec['worldly_default'] == 'drop' else {}
    every_post = {str(p['id']): (b, ch, s, p) for b, chs in src.items() for ch, passes in chs.items()
                  for s in passes for p in s['posts']}
    post_dec = {str(k): v for k, v in dec['posts'].items()}
    study_dec = {str(k): v for k, v in dec['studies'].items()}

    flagged = defaultdict(list)          # (book, chapter) -> [(post, reason, decision)]
    stats = Counter()
    index = []
    latest = None                        # newest series study, for "continue where the series is"
    os.makedirs(os.path.join(OUT, 'books'), exist_ok=True)

    # standalone teachings listed on the chapters they teach on ("More teaching on Romans 5")
    more = defaultdict(lambda: defaultdict(list))
    if os.path.exists(STANDALONE):
        for x in json.load(open(STANDALONE, encoding='utf-8'))['teachings']:
            for ref in x.get('chapters', []):
                m = re.match(r'^(.*\S)\s+(\d+)$', ref)
                if m and x.get('topics'):
                    more[m.group(1)][m.group(2)].append({'id': x['id'], 'title': x['title'], 'date': x['date'][:10],
                                                         'topic': x['topics'][0]})

    for bi, book in enumerate(BOOKS):
        chapters = src.get(book, {})
        book_out = {'book': book, 'slug': slug(book), 'chapters': CHAPTERS[bi], 'studies': {}}
        if book in more:
            book_out['more'] = {c: sorted(v, key=lambda x: x['date'], reverse=True) for c, v in more[book].items()}
        def clean_study(study, ch):
            posts = []
            for p in study['posts']:
                pid = str(p['id'])
                text = p['text']
                if p['kind'] == 'study':
                    text = strip_links(text)
                    reason = None if p.get('added') else flag_reason(p, text)
                    choice = post_dec.get(pid)
                    if reason:
                        flagged[(book, ch)].append((p, reason, choice, study))
                        stats['flagged'] += 1
                        stats['flagged_' + ('2022-23' if p['date'][:4] in ('2022', '2023') else '2024+')] += 1
                    keep = choice == 'keep' or (choice is None and not (reason and dec['flagged_default'] == 'drop')
                                                and pid not in worldly)
                    if not keep:
                        stats['posts_hidden'] += 1
                        continue
                    if not text and not p.get('media'):
                        continue
                elif post_dec.get(pid) == 'drop':
                    continue
                out = {'id': p['id'], 'date': p['date'][:16], 'kind': p['kind'], 'text': no_telegram(text)}
                if p.get('media'):
                    out['media'] = p['media']
                filed = topics['posts'].get(pid)
                if filed and filed.get('teaching') is not False and filed.get('topics'):
                    out['topics'] = filed['topics']
                posts.append(out)
                posts_by_id.setdefault(pid, (book, ch, study, out))
            chars = sum(own_words(p['text']) for p in posts if p['kind'] == 'study')
            res = {'date': study['date'], 'series': study['series'], 'chars': chars, 'posts': posts}
            r = verse_range(study)
            if r and not study.get('gathered'):
                res['range'] = r
            if study.get('label'):
                res['label'] = study['label']
            if study.get('title'):                 # a study written in Google Drive: no Telegram link
                res['title'] = study['title']
                res['source'] = study.get('source')
            return res

        for ch_s in sorted(chapters, key=int):
            ch = int(ch_s)
            passes = chapters[ch_s]
            primary = next((s for s in passes if s.get('primary')), None)
            main_pass, status = None, 'none'

            def shown(s):
                o = study_dec.get(start_id(s))
                if o:
                    return o == 'show'
                return sum(own_words(p['text']) for p in s['posts'] if p['kind'] == 'study') >= MIN_CHARS

            # Newest first: the teaching got better over the years, so the latest series pass with
            # commentary is the main study, and the other passes are listed newest to oldest.
            series = [s for s in passes if s['series'] and s['study_chars'] > 0 and (s is primary or shown(s))]
            if series:
                main_pass, status = max(series, key=lambda s: s['date']), 'series'
            elif primary and primary.get('commentary_with'):
                main_pass, status = primary, 'with'
            else:
                earlier = [s for s in passes if s is not primary and not s['series'] and not s.get('gathered') and shown(s)]
                if earlier:
                    main_pass, status = max(earlier, key=lambda s: s['date']), 'earlier'
            others_src = sorted((s for s in passes if s is not main_pass and shown(s)),
                                key=lambda s: s['date'], reverse=True)

            entry = {'status': status}
            if status == 'series' and (latest is None or main_pass['date'] >= latest['date']):
                latest = {'book': book, 'slug': slug(book), 'chapter': ch, 'date': main_pass['date']}
            if main_pass:
                entry['main'] = clean_study(main_pass, ch)
                if status == 'with':
                    entry['with'] = main_pass['commentary_with']
            others = [clean_study(s, ch) for s in others_src]
            others = [o for o in others if o['chars'] > 0 or study_dec.get(start_id(o)) == 'show']
            if others:
                entry['others'] = others
            if main_pass or others:
                book_out['studies'][ch_s] = entry
            stats['chapters_' + status] += 1

        stats['chapters_none'] += sum(1 for ch in range(1, CHAPTERS[bi] + 1) if str(ch) not in chapters)
        # one letter per chapter for the grid: S series, W with a neighbor, E earlier, O other passes only, - none
        per_ch = {}
        for ch_s, e in book_out['studies'].items():
            per_ch[int(ch_s)] = e['status'] if e.get('main') else 'other'
        status_list = [per_ch.get(c, 'none') for c in range(1, CHAPTERS[bi] + 1)]
        with_list = {c: book_out['studies'][str(c)]['with'] for c in per_ch if book_out['studies'][str(c)].get('with')}

        with open(os.path.join(OUT, 'books', slug(book) + '.json'), 'w', encoding='utf-8') as f:
            json.dump(book_out, f, ensure_ascii=False, separators=(',', ':'))
        index.append({'book': book, 'slug': slug(book), 'testament': 'OT' if book in OLD_TESTAMENT else 'NT',
                      'chapters': CHAPTERS[bi], 'status': ''.join({'series': 'S', 'with': 'W', 'earlier': 'E',
                                                                     'other': 'O', 'none': '-'}[s] for s in status_list),
                      **({'with': with_list} if with_list else {})})

    with open(os.path.join(OUT, 'books.json'), 'w', encoding='utf-8') as f:
        json.dump({'min_chars': MIN_CHARS, 'latest': latest, 'books': index}, f, ensure_ascii=False, separators=(',', ':'))

    write_review(flagged, dec)
    n_filed, n_unsorted = write_topics(topics, posts_by_id)
    n_worldly = write_worldly(every_post, dec)
    print(f"Books written to {os.path.relpath(OUT, ROOT)}/")
    print(f"Chapters: series {stats['chapters_series']}, with neighbor {stats['chapters_with']}, "
          f"earlier study {stats['chapters_earlier']}, not yet studied {stats['chapters_none']}")
    print(f"Flagged posts: {stats['flagged']} (2022-23: {stats['flagged_2022-23']}, 2024+: {stats['flagged_2024+']}); "
          f"hidden in the app: {stats['posts_hidden']}")
    print(f"Review list: {os.path.relpath(FLAGGED, ROOT)}")
    print(f"Corrections applied: {fixed}" + (f"; no longer matching (check these): {missed}" if missed else ''))
    print(f"Posts refiled or added (review/refile.json): {refiled}")
    print(f"Doctrine topics: {len(topics['topics'])}, teachings filed: {n_filed}; "
          f"not filed yet: {n_unsorted} (see {os.path.relpath(UNSORTED, ROOT)})")
    if n_worldly:
        print(f"Worldly posts: {n_worldly}, " + ('left out of the app' if dec['worldly_default'] == 'drop' else 'shown')
              + f" (see {os.path.relpath(WORLDLY_MD, ROOT)})")


def write_review(flagged, dec):
    os.makedirs(os.path.dirname(FLAGGED), exist_ok=True)
    if not os.path.exists(DECISIONS):
        with open(DECISIONS, 'w', encoding='utf-8') as f:
            json.dump({'flagged_default': 'drop', 'posts': {}, 'studies': {}}, f, indent=2)
            f.write('\n')
    total = sum(len(v) for v in flagged.values())
    undecided = sum(1 for v in flagged.values() for x in v if x[2] is None)
    L = ['# Flagged study posts\n',
         f'\n{total} posts flagged, {undecided} still undecided. Undecided posts are currently '
         f"**{'hidden' if dec['flagged_default'] == 'drop' else 'shown'}** in the app "
         '(`flagged_default` in decisions.json).\n',
         '\nTo decide, add the post id to `review/decisions.json` under `"posts"` as `"keep"` or `"drop"`, '
         'then rerun `python3 tools/clean_studies.py`. Your choices survive a re-export.\n',
         '\nThis file is regenerated on every run; don\'t edit it.\n']
    by_book = defaultdict(int)
    for (b, c), v in flagged.items():
        by_book[b] += len(v)
    L.append('\n## Count by book\n\n| Book | Flagged |\n|---|---|\n')
    for b in BOOKS:
        if by_book[b]:
            L.append(f'| {b} | {by_book[b]} |\n')
    for b in BOOKS:
        chs = sorted((c for (bb, c) in flagged if bb == b), key=int)
        if not chs:
            continue
        L.append(f'\n## {b}\n')
        for c in chs:
            L.append(f'\n### {b} {c}\n\n')
            for p, reason, choice, study in flagged[(b, c)]:
                link = study['link'].rsplit('/', 1)[0] + '/' + str(p['id'])
                state = f'**{choice}**' if choice else 'undecided'
                excerpt = re.sub(r'\s+', ' ', p['text'].replace('*', '')).strip()
                excerpt = (excerpt[:160] + '…') if len(excerpt) > 160 else excerpt
                L.append(f"- `{p['id']}` · {p['date'][:10]} · [post]({link}) · {reason} · {state}\n"
                         f"  > {excerpt or '(no text)'}\n")
    with open(FLAGGED, 'w', encoding='utf-8') as f:
        f.write(''.join(L))


if __name__ == '__main__':
    main()
    import build_search   # the search index reads what was just written
    build_search.main()
