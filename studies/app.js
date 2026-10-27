/* Chapter Studies — book → chapter grid → study.
   Data comes from data/ (written by tools/clean_studies.py), one book at a time.
   The KJV text is read from the KJV Bible app's published files; links to that app open
   it in a new tab and nothing is ever added to it. */
(function () {
  'use strict';

  const KJV_APP = 'https://fbckjv.app/KJVBible/';
  const view = document.getElementById('view');
  const crumbs = document.getElementById('crumbs');
  let INDEX = null;
  const bookCache = {};
  const kjvCache = {};

  const STATUS_TEXT = {
    S: 'Series study',
    W: 'Commentary with a neighbor chapter',
    E: 'Earlier study',
    O: 'Other passes only',
    '-': 'Not yet studied'
  };

  // ---------- helpers ----------
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function fmtDate(iso) {
    const d = new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function kjvAppLink(book, ch) {
    return KJV_APP + '#' + book.split(' ').map(encodeURIComponent).join('+') + '+' + ch;
  }

  function telegramPost(studyLink, id) {
    return studyLink.replace(/\/\d+$/, '/' + id);
  }

  // "Psalm 23", like the KJV app; every other book is just "Book N"
  function chapterName(book, ch) {
    return (book === 'Psalms' ? 'Psalm' : book) + ' ' + ch;
  }

  function bookBySlug(slug) {
    return INDEX.books.find(b => b.slug.toLowerCase() === String(slug).toLowerCase());
  }

  function studiedCount(b) {
    return (b.status.match(/[SWE]/g) || []).length;
  }

  async function getJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(r.status + ' ' + url);
    return r.json();
  }

  function loadBook(slug) {
    return bookCache[slug] || (bookCache[slug] = getJSON('data/books/' + slug + '.json')
      .catch(e => { delete bookCache[slug]; throw e; }));
  }

  // KJV text from the Bible app's published data. If it can't be reached (offline, or the
  // file moved) the study falls back to the chapter text that was posted on Telegram.
  function loadKJV(slug) {
    return kjvCache[slug] || (kjvCache[slug] = getJSON(KJV_APP + 'bible/' + slug + '.json')
      .catch(() => { delete kjvCache[slug]; return null; }));
  }

  function setCrumbs(parts) {
    crumbs.innerHTML = parts.map((p, i) => {
      const last = i === parts.length - 1;
      const sep = i ? '<span class="sep">/</span>' : '';
      return sep + (last ? `<span class="here">${esc(p[0])}</span>` : `<a href="${p[1]}">${esc(p[0])}</a>`);
    }).join('');
  }

  // ---------- markdown (the subset extract_studies.py writes) ----------
  const URL_RE = /\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]/g;

  function inline(raw) {
    const links = [];
    let s = raw.replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, (m, t, u) => {
      links.push(`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`);
      return '\u0000' + (links.length - 1) + '\u0000';
    });
    s = s.replace(URL_RE, u => {
      links.push(`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a>`);
      return '\u0000' + (links.length - 1) + '\u0000';
    });
    s = esc(s)
      .replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
      .replace(/\*/g, '');
    return s.replace(/\u0000(\d+)\u0000/g, (m, i) => links[+i]);
  }

  const isItalic = l => /^\s*\*(?!\*)[^\n]*[^*\s]\*[.,;:!?'"’”]*\s*$/.test(l) || /^\s*\*[^*\s]\*\s*$/.test(l);
  const isBoldRef = l => /^\s*\*\*[^*]+\*\*\s*$/.test(l) && /\d/.test(l) && l.replace(/\*/g, '').trim().length < 60;

  // Paragraphs of italic lines are scripture; a bold reference line is its citation. Some posts put
  // the reference above the quote and some below it, so a post that ever cites below is read that way.
  // A scripture post (a chapter's text) is always shown as a quotation.
  function render(text, scripture) {
    const paras = text.split(/\n\s*\n/).map(p => p.split('\n').filter(l => l.trim())).filter(p => p.length);
    const allItalic = ls => ls.length > 0 && ls.every(isItalic);
    const citesBelow = paras.some((p, i) => isBoldRef(p[p.length - 1]) &&
      (allItalic(p.slice(0, -1)) || (p.length === 1 && i > 0 && allItalic(paras[i - 1]))));
    const quote = (cite, body) => '<blockquote class="quote">' + (cite ? `<cite>${inline(cite)}</cite>` : '') +
      body.map(inline).join('<br>') + '</blockquote>';
    const out = [];
    for (let i = 0; i < paras.length; i++) {
      const lines = paras[i];
      const last = lines[lines.length - 1];
      if (citesBelow && isBoldRef(last) && allItalic(lines.slice(0, -1))) {
        out.push(quote(last, lines.slice(0, -1)));
      } else if (citesBelow && lines.length === 1 && isBoldRef(last) && allItalic(paras[i - 1] || [])) {
        out.pop();
        out.push(quote(last, paras[i - 1]));
      } else if (isBoldRef(lines[0]) && (allItalic(lines.slice(1)) ||
                 (lines.length === 1 && !citesBelow && allItalic(paras[i + 1] || [])))) {
        out.push(quote(lines[0], lines.length > 1 ? lines.slice(1) : paras[++i]));
      } else if (scripture || allItalic(lines)) {
        out.push(quote(null, lines));
      } else {
        out.push('<p>' + lines.map(inline).join('<br>') + '</p>');
      }
    }
    return out.join('');
  }

  function renderPosts(posts, study, opts) {
    let html = '', day = null;
    posts.forEach(p => {
      if (opts.skipScripture && p.kind === 'scripture') return;
      const d = p.date.slice(0, 10);
      if (opts.days && day && d !== day) html += `<div class="day">${esc(fmtDate(d))}</div>`;
      day = d;
      let body = '';
      if (p.media) {
        const what = { photo: 'Photo', video_file: 'Video', animation: 'Animation' }[p.media] || 'Media';
        body += `<a class="media" href="${esc(telegramPost(study.link, p.id))}" target="_blank" rel="noopener">📷 ${what} — view on Telegram ↗</a>`;
      }
      if (p.text) body += render(p.text, p.kind === 'scripture');
      if (body) html += `<div class="post" data-id="${p.id}">${body}</div>`;
    });
    return html;
  }

  // ---------- views ----------
  function home() {
    document.title = 'Chapter Studies — Jag\'s House of Wews';
    setCrumbs([['All books', '#']]);
    view.classList.add('wide');
    const total = INDEX.books.reduce((n, b) => n + b.chapters, 0);
    const done = INDEX.books.reduce((n, b) => n + studiedCount(b), 0);
    const L = INDEX.latest;
    const last = lastOpened();
    const showLast = last && !(L && last.book.slug === L.slug && last.ch === L.chapter);
    const tiles = t => INDEX.books.filter(b => b.testament === t).map(b => {
      const n = studiedCount(b), pct = Math.round(100 * n / b.chapters);
      return `<a class="book" href="#${b.slug}">
        <span class="book-name">${esc(b.book)}</span>
        <span class="book-count">${n === b.chapters ? `All ${b.chapters} chapters` : `${n} of ${b.chapters} chapters`}</span>
        <span class="bar"><i style="width:${pct}%"></i></span></a>`;
    }).join('');
    view.innerHTML = `
      <div class="hero">
        <h1>Chapter Studies</h1>
        <div class="hero-rule"><div class="hero-rule-line"></div><div class="hero-rule-diamond"></div><div class="hero-rule-line r"></div></div>
        <p>${done.toLocaleString()} of ${total.toLocaleString()} chapters studied, Genesis to Revelation. Pick a book, then a chapter.</p>
      </div>
      <div class="continue-row">
        ${showLast ? `<a class="continue" href="#${last.book.slug}-${last.ch}"><span class="label">Where you left off</span>
          <strong>${esc(chapterName(last.book.book, last.ch))}</strong></a>` : ''}
        ${L ? `<a class="continue" href="#${L.slug}-${L.chapter}"><span class="label">Latest in the series</span>
          <strong>${esc(chapterName(L.book, L.chapter))}</strong><em>${esc(fmtDate(L.date))}</em></a>` : ''}
      </div>
      ${jumpBox('home-jump')}
      <div class="section-header"><h2>Old Testament</h2><span>Genesis – Malachi</span></div>
      <div class="book-grid">${tiles('OT')}</div>
      <div class="section-header"><h2>New Testament</h2><span>Matthew – Revelation</span></div>
      <div class="book-grid">${tiles('NT')}</div>`;
    wireJump(view, hash => { location.hash = hash; });
  }

  function bookView(b) {
    document.title = b.book + ' — Chapter Studies';
    setCrumbs([['All books', '#'], [b.book, '#' + b.slug]]);
    view.classList.add('wide');
    const n = studiedCount(b);
    const cells = [...b.status].map((s, i) => {
      const ch = i + 1, cls = s === '-' ? 'none' : s;
      const title = s === 'W' ? `Commentary with ${b.with[ch]}` : STATUS_TEXT[s];
      return `<a class="ch st-${cls}" href="#${b.slug}-${ch}" title="${esc(chapterName(b.book, ch) + ' · ' + title)}">${ch}</a>`;
    }).join('');
    const used = new Set(b.status);
    const legend = ['S', 'E', 'W', 'O', '-'].filter(s => used.has(s))
      .map(s => `<span><i class="st-${s === '-' ? 'none' : s}"></i>${STATUS_TEXT[s]}</span>`).join('');
    view.innerHTML = `
      <div class="hero">
        <h1>${esc(b.book)}</h1>
        <div class="hero-rule"><div class="hero-rule-line"></div><div class="hero-rule-diamond"></div><div class="hero-rule-line r"></div></div>
        <p>${n === b.chapters ? `All ${b.chapters} chapters studied` : `${n} of ${b.chapters} chapters studied`}</p>
      </div>
      <div class="section-header"><h2>Chapters</h2></div>
      <div class="legend">${legend}</div>
      <div class="chapter-grid">${cells}</div>`;
  }

  function kjvBlock(kjv, ch, fallbackStudy) {
    const chapter = kjv && kjv.chapters && kjv.chapters[ch - 1];
    if (chapter) {
      return chapter.verses.map(v => `<p class="v"><sup>${esc(v.verse)}</sup>${esc(v.text)}</p>`).join('');
    }
    const posts = fallbackStudy ? fallbackStudy.posts.filter(p => p.kind === 'scripture') : [];
    if (!posts.length) return '';
    return '<p class="from-post">Chapter text as posted on Telegram (the KJV Bible app couldn\'t be reached).</p>' +
      posts.map(p => `<div class="post">${render(p.text, true)}</div>`).join('');
  }

  function passLabel(s) {
    const kind = s.series ? 'Series pass' : 'One-off';
    return `<b>${kind}${s.range ? ' · ' + esc(s.range) : ''}</b><small>${esc(fmtDate(s.date))} · ${s.chars.toLocaleString()} characters of commentary</small>`;
  }

  async function chapterView(b, ch) {
    const title = chapterName(b.book, ch);
    document.title = title + ' — Chapter Studies';
    setCrumbs([['All books', '#'], [b.book, '#' + b.slug], [String(ch), `#${b.slug}-${ch}`]]);
    view.classList.remove('wide');
    view.innerHTML = '<p class="loading">Loading ' + esc(title) + '…</p>';
    setFab(b, ch);
    remember(b, ch);

    const [data, kjv] = await Promise.all([loadBook(b.slug), loadKJV(b.slug)]);
    if (location.hash !== `#${b.slug}-${ch}`) return;           // moved on while loading
    const entry = data.studies[String(ch)] || { status: 'none' };
    const main = entry.main;
    const kjvHref = kjvAppLink(b.book, ch);

    let tag = '', meta = '';
    if (entry.status === 'series') tag = '<span class="tag">Series study</span>';
    else if (entry.status === 'earlier') tag = '<span class="tag gold">Earlier study</span>';
    else if (entry.status === 'with') tag = '<span class="tag gold">Scripture</span>';
    else tag = '<span class="tag gold">Not yet studied</span>';
    if (main) meta = `<span>Posted ${esc(fmtDate(main.date))}${main.range ? ' · ' + esc(main.range) : ''}</span>`;

    const actions = `<div class="actions">
        <a class="btn primary" href="${esc(kjvHref)}" target="_blank" rel="noopener">Read in the KJV app ↗</a>
        ${main ? `<a class="btn" href="${esc(main.link)}" target="_blank" rel="noopener">View on Telegram ↗</a>` : ''}
        ${main && entry.status !== 'with' ? '<a class="btn" href="#commentary" data-jump>Skip to commentary ↓</a>' : ''}
      </div>`;

    let body = '';
    if (!main) {
      body += `<div class="notice"><strong>Not yet studied</strong>${esc(title)} hasn't had a study on the channel yet.</div>`;
    } else {
      const text = kjvBlock(kjv, ch, main);
      const long = kjv && kjv.chapters[ch - 1] && kjv.chapters[ch - 1].verses.length > 30;
      if (text) {
        body += `<div class="section-header"><h2>King James Bible</h2><span>${esc(title)}</span></div>
          <div class="kjv${long ? ' folded' : ''}" id="kjv">${text}</div>
          ${long ? '<button class="btn unfold" id="unfold">Show the whole chapter</button>' : ''}`;
      }
      if (entry.status === 'with') {
        const [wb, wc] = splitRef(entry.with);
        const target = bookByName(wb);
        body += `<div class="notice"><strong>Commentary posted with ${esc(entry.with)}</strong>
          The study for ${esc(title)} was posted together with ${esc(entry.with)}.
          <div class="actions"><a class="btn" href="#${target ? target.slug : b.slug}-${wc}">Go to the ${esc(entry.with)} study →</a></div></div>`;
      } else {
        body += `<div class="section-header" id="commentary"><h2>Commentary</h2><span>${esc(fmtDate(main.date))}</span></div>
          ${renderPosts(main.posts, main, { skipScripture: !!(kjv && kjv.chapters[ch - 1]), days: true })}`;
      }
    }
    if (entry.others && entry.others.length) {
      body += `<div class="section-header"><h2>${main ? 'Other passes' : 'Passes'} on ${esc(title)}</h2><span>${entry.others.length}</span></div>` +
        entry.others.map(s => `<details class="pass"><summary>${passLabel(s)}</summary>
          <div class="pass-body"><p class="actions"><a class="btn" href="${esc(s.link)}" target="_blank" rel="noopener">View on Telegram ↗</a></p>
          ${renderPosts(s.posts, s, { skipScripture: false, days: true })}</div></details>`).join('');
    }

    const prev = ch > 1 ? ch - 1 : null, next = ch < b.chapters ? ch + 1 : null;
    const pageLink = (c, label) => c ? `<a href="#${b.slug}-${c}" class="${b.status[c - 1] === '-' ? 'st-none-link' : ''}">${label}</a>` : '<span></span>';

    view.innerHTML = `
      <div class="readbar">
        <button type="button" class="readbar-loc" id="readbar-loc" aria-haspopup="dialog"
                title="Jump to another chapter">${esc(title)} <span aria-hidden="true">▾</span></button>
      </div>
      <div class="chapter-head">
        <h1 class="page-title">${esc(title)}</h1>
        <div class="meta">${tag}${meta}</div>
        ${actions}
      </div>
      ${body}
      <nav class="pager">${pageLink(prev, `← ${esc(chapterName(b.book, prev))}`)}${pageLink(next, `${esc(chapterName(b.book, next))} →`)}</nav>`;

    document.getElementById('readbar-loc').onclick = () => openSheet(b, ch);
    const unfold = document.getElementById('unfold');
    if (unfold) unfold.onclick = () => { document.getElementById('kjv').classList.remove('folded'); unfold.remove(); };
    const jump = view.querySelector('[data-jump]');
    if (jump) jump.onclick = e => {
      e.preventDefault();
      document.getElementById('commentary').scrollIntoView({ behavior: 'smooth' });
    };
  }

  function splitRef(ref) {
    const m = String(ref).match(/^(.*\S)\s+(\d+)$/);
    return m ? [m[1], +m[2]] : [ref, 1];
  }

  function bookByName(name) {
    return INDEX.books.find(b => b.book.toLowerCase() === String(name).toLowerCase());
  }

  // ---------- quick jump: "ps 23", "1 cor 13", "song", "II Kings 4:2" ----------
  const ALIASES = {
    gen: 'Genesis', ge: 'Genesis', gn: 'Genesis', ex: 'Exodus', exo: 'Exodus', exod: 'Exodus', lev: 'Leviticus',
    lv: 'Leviticus', num: 'Numbers', nu: 'Numbers', nm: 'Numbers', deut: 'Deuteronomy', dt: 'Deuteronomy',
    josh: 'Joshua', jos: 'Joshua', judg: 'Judges', jdg: 'Judges', jg: 'Judges', ru: 'Ruth', rth: 'Ruth',
    '1sam': '1 Samuel', '1sa': '1 Samuel', '2sam': '2 Samuel', '2sa': '2 Samuel', '1ki': '1 Kings', '1kgs': '1 Kings',
    '2ki': '2 Kings', '2kgs': '2 Kings', '1chr': '1 Chronicles', '1ch': '1 Chronicles', '2chr': '2 Chronicles',
    '2ch': '2 Chronicles', ezr: 'Ezra', neh: 'Nehemiah', est: 'Esther', esth: 'Esther', jb: 'Job', ps: 'Psalms',
    psa: 'Psalms', psalm: 'Psalms', pss: 'Psalms', prov: 'Proverbs', pr: 'Proverbs', prv: 'Proverbs',
    eccl: 'Ecclesiastes', ecc: 'Ecclesiastes', ec: 'Ecclesiastes', qoh: 'Ecclesiastes', song: 'Song of Solomon',
    sos: 'Song of Solomon', ss: 'Song of Solomon', so: 'Song of Solomon', cant: 'Song of Solomon',
    songofsongs: 'Song of Solomon', isa: 'Isaiah', is: 'Isaiah', jer: 'Jeremiah', je: 'Jeremiah',
    lam: 'Lamentations', ezek: 'Ezekiel', eze: 'Ezekiel', ezk: 'Ezekiel', dan: 'Daniel', da: 'Daniel', dn: 'Daniel',
    hos: 'Hosea', joe: 'Joel', jl: 'Joel', am: 'Amos', obad: 'Obadiah', ob: 'Obadiah', jon: 'Jonah', jnh: 'Jonah',
    mic: 'Micah', mi: 'Micah', nah: 'Nahum', na: 'Nahum', hab: 'Habakkuk', zeph: 'Zephaniah', zep: 'Zephaniah',
    hag: 'Haggai', zech: 'Zechariah', zec: 'Zechariah', mal: 'Malachi', mt: 'Matthew', matt: 'Matthew',
    mat: 'Matthew', mk: 'Mark', mar: 'Mark', mrk: 'Mark', lk: 'Luke', luk: 'Luke', jn: 'John', jhn: 'John',
    joh: 'John', ac: 'Acts', act: 'Acts', rom: 'Romans', ro: 'Romans', rm: 'Romans', '1cor': '1 Corinthians',
    '1co': '1 Corinthians', '2cor': '2 Corinthians', '2co': '2 Corinthians', gal: 'Galatians', ga: 'Galatians',
    eph: 'Ephesians', phil: 'Philippians', php: 'Philippians', pp: 'Philippians', col: 'Colossians',
    '1thess': '1 Thessalonians', '1th': '1 Thessalonians', '1thes': '1 Thessalonians', '2thess': '2 Thessalonians',
    '2th': '2 Thessalonians', '2thes': '2 Thessalonians', '1tim': '1 Timothy', '1ti': '1 Timothy',
    '2tim': '2 Timothy', '2ti': '2 Timothy', tit: 'Titus', ti: 'Titus', phlm: 'Philemon', philem: 'Philemon',
    phm: 'Philemon', heb: 'Hebrews', jas: 'James', jam: 'James', jm: 'James', '1pet': '1 Peter', '1pe': '1 Peter',
    '1pt': '1 Peter', '2pet': '2 Peter', '2pe': '2 Peter', '2pt': '2 Peter', '1jn': '1 John', '1jo': '1 John',
    '1joh': '1 John', '2jn': '2 John', '2jo': '2 John', '3jn': '3 John', '3jo': '3 John', jud: 'Jude', jude: 'Jude',
    rev: 'Revelation', re: 'Revelation', rv: 'Revelation', revelations: 'Revelation'
  };

  // Returns {book, ch} (ch may be null for a whole book) or null.
  function parseRef(text) {
    let s = String(text).toLowerCase().trim().replace(/\./g, ' ').replace(/\s+/g, ' ');
    s = s.replace(/^(iii|ii|i|first|second|third|1st|2nd|3rd)\s+/, w =>
      ({ i: '1', ii: '2', iii: '3', first: '1', second: '2', third: '3', '1st': '1', '2nd': '2', '3rd': '3' })[w.trim()]);
    const m = s.match(/^([1-3]?\s*[a-z][a-z ]*?)\s*(\d+)?(?:\s*:\s*\d+.*)?$/);
    if (!m) return null;
    const key = m[1].replace(/\s+/g, '');
    let name = ALIASES[key];
    if (!name) {
      const hit = INDEX.books.find(b => b.book.toLowerCase().replace(/\s+/g, '').startsWith(key));
      name = hit && hit.book;
    }
    const b = name && bookByName(name);
    if (!b) return null;
    const ch = m[2] ? Math.min(Math.max(1, parseInt(m[2], 10)), b.chapters) : null;
    return { book: b, ch };
  }

  function jumpBox(id) {
    return `<form class="jump" data-jump-form>
      <label for="${id}" class="label">Go to a chapter</label>
      <div class="jump-row">
        <input id="${id}" type="text" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false"
               placeholder="ps 23, 1 cor 13, rev 1" aria-describedby="${id}-hint">
        <button class="btn primary" type="submit">Go</button>
      </div>
      <p class="jump-hint" id="${id}-hint" aria-live="polite"></p>
    </form>`;
  }

  function wireJump(root, onGo) {
    root.querySelectorAll('[data-jump-form]').forEach(form => {
      const input = form.querySelector('input'), hint = form.querySelector('.jump-hint');
      input.addEventListener('input', () => {
        const r = input.value.trim() && parseRef(input.value);
        hint.textContent = !input.value.trim() ? '' : r ? '→ ' + (r.ch ? chapterName(r.book.book, r.ch) : r.book.book)
          : 'No book matches that. Try the first few letters, like "deut" or "1 jn".';
      });
      form.addEventListener('submit', e => {
        e.preventDefault();
        const r = parseRef(input.value);
        if (!r) { hint.textContent = 'No book matches that. Try the first few letters, like "deut" or "1 jn".'; return; }
        input.value = ''; hint.textContent = '';
        onGo(r.ch ? `#${r.book.slug}-${r.ch}` : `#${r.book.slug}`);
      });
    });
  }

  // ---------- last study opened (this browser only) ----------
  function remember(b, ch) {
    try { localStorage.setItem('wews_last', JSON.stringify({ slug: b.slug, ch })); } catch (e) { /* storage blocked */ }
  }

  function lastOpened() {
    try {
      const v = JSON.parse(localStorage.getItem('wews_last') || 'null');
      const b = v && bookBySlug(v.slug);
      return b && v.ch >= 1 && v.ch <= b.chapters ? { book: b, ch: v.ch } : null;
    } catch (e) { return null; }
  }

  // ---------- chapter picker sheet (like the KJV app's): Back closes it ----------
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.hidden = true;
  sheet.innerHTML = `<div class="sheet-backdrop" data-close></div>
    <div class="sheet-panel" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <div class="sheet-head">
        <h2 id="sheet-title"></h2>
        <button class="sheet-x" type="button" data-close aria-label="Close">✕</button>
      </div>
      <label class="label" for="sheet-book">Book</label>
      <select id="sheet-book"></select>
      <div class="chapter-grid sheet-grid" id="sheet-grid"></div>
      ${jumpBox('sheet-jump')}
    </div>`;
  document.body.appendChild(sheet);
  const sheetBook = sheet.querySelector('#sheet-book');
  const sheetGrid = sheet.querySelector('#sheet-grid');

  function fillSheet(b, current) {
    sheet.querySelector('#sheet-title').textContent = b.book;
    sheetBook.value = b.slug;
    sheetGrid.innerHTML = [...b.status].map((s, i) => {
      const ch = i + 1, cls = s === '-' ? 'none' : s;
      return `<a class="ch st-${cls}${ch === current ? ' cur' : ''}" href="#${b.slug}-${ch}" data-go
        title="${esc(chapterName(b.book, ch) + ' · ' + STATUS_TEXT[s])}">${ch}</a>`;
    }).join('');
  }

  function openSheet(b, current) {
    if (!sheetBook.options.length) {
      sheetBook.innerHTML = ['OT', 'NT'].map(t => `<optgroup label="${t === 'OT' ? 'Old Testament' : 'New Testament'}">` +
        INDEX.books.filter(x => x.testament === t).map(x => `<option value="${x.slug}">${esc(x.book)}</option>`).join('') +
        '</optgroup>').join('');
    }
    fillSheet(b, current);
    sheet.hidden = false;
    document.body.classList.add('sheet-open');
    history.pushState({ sheet: true }, '', location.href);      // Back closes the sheet
    const cur = sheetGrid.querySelector('.cur') || sheetGrid.firstElementChild;
    if (cur) cur.focus({ preventScroll: true });
    if (cur) cur.scrollIntoView({ block: 'center' });
  }

  function hideSheet() {
    sheet.hidden = true;
    document.body.classList.remove('sheet-open');
  }

  // Leaving the sheet for a page replaces its history entry, so Back then returns to where you were.
  function sheetGo(hash) {
    hideSheet();
    history.replaceState(null, '', hash);
    route();
  }

  sheetBook.addEventListener('change', () => fillSheet(bookBySlug(sheetBook.value), null));
  sheet.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) { e.preventDefault(); history.back(); return; }
    const a = e.target.closest('[data-go]');
    if (a) { e.preventDefault(); sheetGo(a.getAttribute('href')); }
  });
  sheet.addEventListener('keydown', e => { if (e.key === 'Escape') history.back(); });
  wireJump(sheet, sheetGo);
  window.addEventListener('popstate', () => { if (!sheet.hidden) hideSheet(); });

  // ---------- floating Prev / Next (press and hold: skip to the nearest studied chapter) ----------
  const fab = document.createElement('nav');
  fab.className = 'float-nav';
  fab.hidden = true;
  fab.setAttribute('aria-label', 'Chapter');
  fab.innerHTML = `<a class="rfloat" id="r-prev" href="#"><span aria-hidden="true">‹</span> Prev</a>
    <a class="rfloat" id="r-next" href="#">Next <span aria-hidden="true">›</span></a>`;
  document.body.appendChild(fab);

  // Every chapter of the Bible in order, so Next runs from Malachi 4 into Matthew 1.
  function step(b, ch, dir, studiedOnly) {
    let bi = INDEX.books.indexOf(b), c = ch;
    for (let n = 0; n < 1189; n++) {
      c += dir;
      if (c < 1) { if (--bi < 0) return null; c = INDEX.books[bi].chapters; }
      if (c > INDEX.books[bi].chapters) { if (++bi >= INDEX.books.length) return null; c = 1; }
      const nb = INDEX.books[bi];
      if (!studiedOnly || /[SWE]/.test(nb.status[c - 1])) return { book: nb, ch: c };
    }
    return null;
  }

  function setFab(b, ch) {
    [['r-prev', -1], ['r-next', 1]].forEach(([id, dir]) => {
      const a = fab.querySelector('#' + id), t = step(b, ch, dir, false), skip = step(b, ch, dir, true);
      a.hidden = !t;
      if (!t) return;
      a.href = `#${t.book.slug}-${t.ch}`;
      a.dataset.skip = skip ? `#${skip.book.slug}-${skip.ch}` : '';
      a.title = `${chapterName(t.book.book, t.ch)}` +
        (skip && (skip.book !== t.book || skip.ch !== t.ch) ? ` · hold for ${chapterName(skip.book.book, skip.ch)}` : '');
      a.setAttribute('aria-label', (dir < 0 ? 'Previous: ' : 'Next: ') + chapterName(t.book.book, t.ch));
    });
    fab.hidden = false;
  }

  fab.querySelectorAll('.rfloat').forEach(a => {
    let timer = null, held = false;
    const start = () => {
      held = false;
      timer = setTimeout(() => {
        held = true;
        if (a.dataset.skip) location.hash = a.dataset.skip;
        if (navigator.vibrate) navigator.vibrate(15);
      }, 550);
    };
    const cancel = () => clearTimeout(timer);
    a.addEventListener('pointerdown', start);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => a.addEventListener(t, cancel));
    a.addEventListener('contextmenu', e => e.preventDefault());
    a.addEventListener('click', e => { if (held) e.preventDefault(); });
  });

  // ---------- router: (empty)  #Psalms  #Psalms-23 ----------
  async function route() {
    const h = decodeURIComponent(location.hash.slice(1));
    try {
      if (!INDEX) INDEX = await getJSON('data/books.json');
      if (!sheet.hidden) hideSheet();
      fab.hidden = true;
      const m = h.match(/^([A-Za-z0-9]+)(?:-(\d+))?$/);
      if (!m) { home(); }
      else {
        const b = bookBySlug(m[1]);
        const ch = m[2] ? parseInt(m[2], 10) : null;
        if (!b) home();
        else if (ch === null) bookView(b);
        else if (ch >= 1 && ch <= b.chapters) await chapterView(b, ch);
        else { location.hash = b.slug; return; }
      }
      window.scrollTo(0, 0);
    } catch (e) {
      console.error(e);
      view.innerHTML = '<p class="error">This page couldn\'t be loaded. Check your connection and try again.</p>';
    }
  }

  window.addEventListener('hashchange', route);
  route();

  // Offline: keep what's been opened, always prefer the network when it's there.
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
