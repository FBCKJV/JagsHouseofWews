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
      ${L ? `<a class="continue" href="#${L.slug}-${L.chapter}"><span class="label">Latest in the series</span>
        <strong>${esc(chapterName(L.book, L.chapter))}</strong><em>${esc(fmtDate(L.date))}</em></a>` : ''}
      <div class="section-header"><h2>Old Testament</h2><span>Genesis – Malachi</span></div>
      <div class="book-grid">${tiles('OT')}</div>
      <div class="section-header"><h2>New Testament</h2><span>Matthew – Revelation</span></div>
      <div class="book-grid">${tiles('NT')}</div>`;
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
      <div class="chapter-head">
        <h1 class="page-title">${esc(title)}</h1>
        <div class="meta">${tag}${meta}</div>
        ${actions}
      </div>
      ${body}
      <nav class="pager">${pageLink(prev, `← ${esc(chapterName(b.book, prev))}`)}${pageLink(next, `${esc(chapterName(b.book, next))} →`)}</nav>`;

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

  // ---------- router: (empty)  #Psalms  #Psalms-23 ----------
  async function route() {
    const h = decodeURIComponent(location.hash.slice(1));
    try {
      if (!INDEX) INDEX = await getJSON('data/books.json');
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
