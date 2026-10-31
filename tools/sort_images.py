#!/usr/bin/env python3
"""
sort_images.py - sort a folder of channel images so you can review them for the Memes tab.

Run it on your own computer (it needs Pillow: pip install pillow), from the repo root:

    python3 tools/sort_images.py PATH/TO/photos --export PATH/TO/result.json

Nothing is deleted or changed. It COPIES (or, with --move, moves) the images into folders under
sorted_images/ and writes a review page you open in a browser:

  already-in-app/    looks like a picture already on the Memes tab (img/pictures)
  duplicates/        exact copies of another image (same bytes); the first one is kept in its category
  near-duplicates/   the same picture resized, recompressed or lightly cropped; the largest is kept
  tiny/              too small to be a teaching picture (default under 200 px on the short side)
  study/<Book Ch>/   attached to a post that is a chapter study in the app. If the picture serves the
                     study, it is a candidate to save with it.
  teaching/          attached to a post filed under a doctrine topic
  topical-review/    attached to a post marked worldly/topical (politics, news, argument): look at whether
                     the post needs the picture, or whether the post itself should be in the app
  meme-candidates/   attached to a post with no or short caption, in no study: the Memes tab candidates
  unsorted/          no export given, or the image is not in it

review.csv lists every image with its category, reason, post id, date and caption, and a blank "keep"
column for your decision. index.html shows the same as thumbnails, by category.

--export is the Telegram Desktop export of the channel: result.json (JSON format) or the folder with
messages.html files (HTML format). Without it, only duplicates, near-duplicates, tiny images and
pictures already in the app are separated; the rest goes to unsorted/.
"""
import argparse, csv, glob, hashlib, html, json, os, re, shutil, sys
from collections import defaultdict

try:
    from PIL import Image
except ImportError:
    sys.exit('This needs Pillow: pip install pillow')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXTS = ('.jpg', '.jpeg', '.png', '.webp', '.gif')


def dhash(path):
    """64-bit difference hash: survives resizing and recompression."""
    try:
        with Image.open(path) as im:
            w, h = im.size
            g = im.convert('L').resize((9, 8), Image.LANCZOS)
            px = list(g.tobytes())
    except Exception:
        return None, 0, 0
    bits = 0
    for row in range(8):
        for col in range(8):
            bits = (bits << 1) | (px[row * 9 + col] > px[row * 9 + col + 1])
    return bits, w, h


def ham(a, b):
    return bin(a ^ b).count('1')


def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


# ---------- what the repo already knows ----------
def known_posts():
    """post id -> ('study', 'Genesis 3') | ('teaching', topic id) | ('worldly', ''), from the app's own data."""
    out = {}
    idx = os.path.join(ROOT, 'studies', 'data', 'books.json')
    if os.path.exists(idx):
        for b in json.load(open(idx, encoding='utf-8'))['books']:
            data = json.load(open(os.path.join(ROOT, 'studies', 'data', 'books', b['slug'] + '.json'), encoding='utf-8'))
            for ch, e in data['studies'].items():
                studies = ([e['main']] if e.get('main') else []) + e.get('others', [])
                for s in studies:
                    for p in s['posts']:
                        out.setdefault(str(p['id']), ('study', f"{b['book']} {ch}"))
    sa = os.path.join(ROOT, 'review', 'standalone.json')
    if os.path.exists(sa):
        for t in json.load(open(sa, encoding='utf-8')).get('teachings', []):
            if t.get('topics'):
                out.setdefault(str(t['id']), ('teaching', t['topics'][0]))
    wl = os.path.join(ROOT, 'review', 'worldly.json')
    if os.path.exists(wl):
        for k in json.load(open(wl, encoding='utf-8')):
            if k.isdigit():
                out[k] = ('worldly', '')          # worldly wins: it is what the author set aside
    return out


# ---------- the Telegram export ----------
def flat(text):
    if isinstance(text, list):
        text = ''.join(x if isinstance(x, str) else x.get('text', '') for x in text)
    return re.sub(r'\s+', ' ', text or '').strip()


def read_export(path):
    """basename of the photo file -> {'id', 'date', 'text'}"""
    out = {}
    if os.path.isdir(path):
        files = sorted(glob.glob(os.path.join(path, 'messages*.html')))
        for f in files:
            page = open(f, encoding='utf-8', errors='replace').read()
            for m in re.finditer(r'<div class="message (?:default|service)[^"]*" id="message(-?\d+)">(.*?)(?=<div class="message |\Z)', page, re.S):
                body = m.group(2)
                ph = re.search(r'href="(photos/[^"]+)"', body)
                if not ph:
                    continue
                txt = re.search(r'<div class="text">(.*?)</div>', body, re.S)
                date = re.search(r'class="pull_right date details" title="([^"]+)"', body)
                out[os.path.basename(ph.group(1))] = {
                    'id': m.group(1), 'date': date.group(1) if date else '',
                    'text': flat(html.unescape(re.sub(r'<[^>]+>', ' ', txt.group(1)))) if txt else ''}
        return out
    data = json.load(open(path, encoding='utf-8'))
    for m in data.get('messages', []):
        if m.get('photo'):
            out[os.path.basename(m['photo'])] = {'id': str(m['id']), 'date': m.get('date', ''), 'text': flat(m.get('text'))}
    return out


# ---------- main ----------
def main():
    ap = argparse.ArgumentParser(description='Sort channel images for review.')
    ap.add_argument('folder')
    ap.add_argument('--export', help='result.json or the folder of messages*.html from the Telegram export')
    ap.add_argument('--out', default='sorted_images')
    ap.add_argument('--move', action='store_true', help='move the files instead of copying them')
    ap.add_argument('--near', type=int, default=6, help='how different two pictures can look and still be called the same (0-64, default 6)')
    ap.add_argument('--min-size', type=int, default=200, help='shortest side in pixels below which an image is "tiny"')
    ap.add_argument('--short-caption', type=int, default=160, help='captions up to this many characters count as meme-style')
    a = ap.parse_args()

    files = sorted(os.path.join(dp, f) for dp, _, fs in os.walk(a.folder) for f in fs if f.lower().endswith(EXTS))
    if not files:
        sys.exit('No images found in ' + a.folder)
    print(f'{len(files)} images')

    info = {}
    for f in files:
        h, w, hgt = dhash(f)
        info[f] = {'sha': sha(f), 'hash': h, 'w': w, 'h': hgt, 'bytes': os.path.getsize(f)}

    posts = read_export(a.export) if a.export else {}
    known = known_posts()
    app_pics = {}
    pdir = os.path.join(ROOT, 'img', 'pictures')
    for p in glob.glob(os.path.join(pdir, '*')):
        if p.lower().endswith(EXTS):
            h, _, _ = dhash(p)
            if h is not None:
                app_pics[os.path.splitext(os.path.basename(p))[0]] = h

    rows = {}
    def put(f, cat, reason='', sub=''):
        if f not in rows:
            rows[f] = {'category': cat, 'sub': sub, 'reason': reason}

    # 1. exact copies: keep the best-named first, mark the rest
    by_sha = defaultdict(list)
    for f in files:
        by_sha[info[f]['sha']].append(f)
    keep = []
    for group in by_sha.values():
        group.sort(key=lambda x: (-info[x]['bytes'], x))
        keep.append(group[0])
        for d in group[1:]:
            put(d, 'duplicates', 'same bytes as ' + os.path.basename(group[0]))

    # 2. already in the app, tiny
    rest = []
    for f in keep:
        i = info[f]
        if i['hash'] is None:
            put(f, 'unsorted', 'could not be read')
            continue
        hit = next((k for k, h in app_pics.items() if ham(i['hash'], h) <= a.near), None)
        if hit:
            put(f, 'already-in-app', 'looks like img/pictures/' + hit)
        elif min(i['w'], i['h']) < a.min_size:
            put(f, 'tiny', f"{i['w']}x{i['h']}")
        else:
            rest.append(f)

    # 3. near copies: cluster by hash distance, keep the largest
    parent = {f: f for f in rest}
    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]; x = parent[x]
        return x
    for i, f in enumerate(rest):
        for g in rest[i + 1:]:
            if ham(info[f]['hash'], info[g]['hash']) <= a.near:
                parent[find(f)] = find(g)
    clusters = defaultdict(list)
    for f in rest:
        clusters[find(f)].append(f)
    survivors = []
    for grp in clusters.values():
        grp.sort(key=lambda x: (-(info[x]['w'] * info[x]['h']), -info[x]['bytes'], x))
        survivors.append(grp[0])
        for d in grp[1:]:
            put(d, 'near-duplicates', 'same picture as ' + os.path.basename(grp[0]))

    # 4. what each remaining picture is attached to
    for f in survivors:
        msg = posts.get(os.path.basename(f))
        if not msg:
            put(f, 'unsorted', 'not in the export' if posts else 'no export given')
            continue
        kind, where = known.get(msg['id'], (None, ''))
        if kind == 'worldly':
            put(f, 'topical-review', 'its post is marked worldly or topical')
        elif kind == 'study':
            put(f, 'study', 'attached to a chapter study', where)
        elif kind == 'teaching':
            put(f, 'teaching', 'attached to a teaching on ' + where)
        elif len(msg['text']) <= a.short_caption:
            put(f, 'meme-candidates', 'no study, caption of %d characters' % len(msg['text']))
        else:
            put(f, 'teaching', 'long caption, in no study yet: a teaching post?')

    # 5. write the folders, the CSV and the review page
    out = a.out
    os.makedirs(out, exist_ok=True)
    action = shutil.move if a.move else shutil.copy2
    table = []
    for f in files:
        r = rows.get(f) or {'category': 'unsorted', 'sub': '', 'reason': ''}
        folder = os.path.join(out, r['category'], re.sub(r'[^\w .-]+', '', r['sub']).strip() if r['sub'] else '')
        os.makedirs(folder, exist_ok=True)
        dest = os.path.join(folder, os.path.basename(f))
        n = 1
        while os.path.exists(dest):
            stem, ext = os.path.splitext(os.path.basename(f))
            dest = os.path.join(folder, f'{stem}-{n}{ext}'); n += 1
        action(f, dest)
        msg = posts.get(os.path.basename(f), {})
        table.append({'file': os.path.relpath(dest, out), 'category': r['category'], 'where': r['sub'], 'reason': r['reason'],
                      'post_id': msg.get('id', ''), 'date': msg.get('date', ''), 'caption': msg.get('text', '')[:300],
                      'size': f"{info[f]['w']}x{info[f]['h']}", 'keep': ''})
    order = ['study', 'meme-candidates', 'topical-review', 'teaching', 'unsorted', 'already-in-app', 'near-duplicates', 'duplicates', 'tiny']
    table.sort(key=lambda t: (order.index(t['category']), t['where'], t['date'], t['file']))
    with open(os.path.join(out, 'review.csv'), 'w', newline='', encoding='utf-8') as fh:
        w = csv.DictWriter(fh, fieldnames=list(table[0]))
        w.writeheader(); w.writerows(table)
    parts = ['<!doctype html><meta charset="utf-8"><title>Image review</title>'
             '<style>body{font:15px system-ui;margin:20px;background:#fafafa}h2{margin:28px 0 6px}'
             '.g{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0;width:210px;background:#fff;border:1px solid #ddd;padding:6px}'
             'img{width:198px;height:198px;object-fit:contain;background:#eee}figcaption{font-size:12px;color:#444;margin-top:4px;word-break:break-word}'
             '</style><h1>Image review</h1>']
    counts = defaultdict(int)
    for t in table:
        counts[t['category']] += 1
    parts.append('<p>' + ' · '.join(f"{c}: {counts[c]}" for c in order if counts[c]) + '</p>')
    for cat in order:
        items = [t for t in table if t['category'] == cat]
        if not items:
            continue
        parts.append(f'<h2>{cat} ({len(items)})</h2><div class="g">')
        for t in items:
            cap = html.escape((t['where'] + ' · ' if t['where'] else '') + t['reason'] + ((' · ' + t['caption']) if t['caption'] else ''))
            parts.append(f'<figure><a href="{html.escape(t["file"])}"><img loading="lazy" src="{html.escape(t["file"])}"></a>'
                         f'<figcaption>{html.escape(t["file"].split(os.sep)[-1])} · {t["size"]}<br>{t["date"]}<br>{cap}</figcaption></figure>')
        parts.append('</div>')
    open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write('\n'.join(parts))
    print('Sorted into', out)
    for c in order:
        if counts[c]:
            print(f'  {c:16} {counts[c]}')
    print('Open', os.path.join(out, 'index.html'), 'to review; decisions go in the "keep" column of review.csv')


if __name__ == '__main__':
    main()
