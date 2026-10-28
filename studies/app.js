/* Chapter Studies — book → chapter grid → study.
   Data comes from data/ (written by tools/clean_studies.py), one book at a time.
   The KJV text is read from the KJV Bible app's published files; links to that app open
   it in a new tab and nothing is ever added to it. */
(function () {
  'use strict';

  const KJV_APP = 'https://fbckjv.app/KJVBible/';
  // Shown on the About page. Started at v1.17 (after 17 merged updates); each merged update adds one.
  const APP_VERSION = '1.36', APP_DATE = '2026-10-28';
  const view = document.getElementById('view');
  const crumbs = document.getElementById('crumbs');
  let INDEX = null;
  const bookCache = {};
  const kjvCache = {};
  let TOPICS = null;                     // doctrine topics index (data/topics.json), loaded when needed
  const topicCache = {};

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
    const r = await fetch(url, { cache: 'no-cache' });   // always ask the server, so updates show at once
    if (!r.ok) throw new Error(r.status + ' ' + url);
    return r.json();
  }

  function loadTopics() {
    return TOPICS ? Promise.resolve(TOPICS)
      : getJSON('data/topics.json').then(t => (TOPICS = t)).catch(() => ({ topics: [] }));
  }

  function loadTopic(id) {
    return topicCache[id] || (topicCache[id] = getJSON('data/topics/' + id + '.json')
      .catch(e => { delete topicCache[id]; throw e; }));
  }

  let LESSONS = null;                    // lessons, slides and pictures (data/lessons.json), loaded when needed
  function loadLessons() {
    return LESSONS ? Promise.resolve(LESSONS)
      : getJSON('data/lessons.json').then(l => (LESSONS = l)).catch(() => ({ shelves: [], lessons: [], pictures: [] }));
  }

  function topicName(id) {
    const t = TOPICS && TOPICS.topics.find(x => x.id === id);
    return t ? t.name : null;
  }

  function filedUnder(ids) {
    const links = (ids || []).map(id => topicName(id) && `<a href="#doctrine-${esc(id)}">${esc(topicName(id))}</a>`).filter(Boolean);
    return links.length ? `<p class="filed">Filed under ${links.join(' · ')}</p>` : '';
  }

  // "John 3:16" -> the KJV app at that verse (it lights the verses up); links go one way only
  function kjvRefLink(ref) {
    const m = String(ref).match(/^(.*?)\s+(\d+)\s*[:.]\s*([\d,\-–\s]+)/);
    if (!m) return null;
    let name = m[1].trim().replace(/^Psalm$/i, 'Psalms');
    const b = bookByName(name) || (parseRef(name + ' 1') || {}).book;
    if (!b) return null;
    return KJV_APP + '#' + b.book.split(' ').map(encodeURIComponent).join('+') + '+' + m[2] + ':' + m[3].replace(/\s+/g, '');
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

  // The trail to this page; `aside` links sit at the right end of the bar. Home has no trail,
  // and a chapter has its own (the "Psalm 23 ▾" bar), so those pass [] and the line is hidden.
  function setCrumbs(parts, aside) {
    crumbs.hidden = parts.length < 2;
    crumbs.innerHTML = parts.map((p, i) => {
      const last = i === parts.length - 1;
      const sep = i ? '<span class="sep">/</span>' : '';
      return sep + (last ? `<span class="here">${esc(p[0])}</span>` : `<a href="${p[1]}">${esc(p[0])}</a>`);
    }).join('') + (aside ? '<span class="crumbs-aside">' +
      aside.map(a => `<a href="${a[1]}">${esc(a[0])} ›</a>`).join('') + '</span>' : '');
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
      if (body && p.topics) body += filedUnder(p.topics);
      if (body) html += `<div class="post" data-id="${p.id}">${body}</div>`;
    });
    return html;
  }

  // ---------- views ----------
  function home() {
    document.title = 'Jag\'s House of Wews — KJV Bible studies';
    setCrumbs([]);
    view.classList.add('wide');
    const total = INDEX.books.reduce((n, b) => n + b.chapters, 0);
    const done = INDEX.books.reduce((n, b) => n + studiedCount(b), 0);
    const L = INDEX.latest;
    const last = lastOpened();
    const showLast = last && !(L && last.book.slug === L.slug && last.ch === L.chapter);
    const books = t => INDEX.books.filter(b => b.testament === t);
    const tiles = t => books(t).map(b => {
      const n = studiedCount(b), pct = Math.round(100 * n / b.chapters);
      return `<a class="book" href="#${b.slug}">
        <span class="book-name">${esc(b.book)}</span>
        <span class="book-count">${b.chapters === 1 ? (n ? 'One chapter' : 'Not yet studied')
          : n === b.chapters ? `All ${b.chapters} chapters` : `${n} of ${b.chapters} chapters`}</span>
        <span class="bar"><i style="width:${pct}%"></i></span></a>`;
    }).join('');
    const testament = (t, name, span) => {
      const n = books(t).reduce((k, b) => k + studiedCount(b), 0);
      const m = books(t).reduce((k, b) => k + b.chapters, 0);
      return `<details class="testament" data-t="${t}"${isOpen(t) ? ' open' : ''}>
        <summary class="section-header"><h2>${name}</h2><span>${span}</span>
          <em>${n.toLocaleString()} of ${m.toLocaleString()} chapters studied</em></summary>
        <div class="book-grid">${tiles(t)}</div></details>`;
    };
    view.innerHTML = `
      <div class="hero">
        <img class="hero-logo" src="../img/logo-256.jpg" alt="" width="132" height="132">
        <h1>Jag’s House of Wews</h1>
        <p>Chapter-by-chapter studies of the King James Bible, with doctrine, lessons and classes.</p>
        <p class="hero-stats">${done.toLocaleString()} of ${total.toLocaleString()} chapters studied, Genesis to Revelation</p>
      </div>
      <a class="gospel-line" href="#heaven">How to know for sure you’re going to Heaven <span aria-hidden="true">→</span></a>
      ${jumpBox('home-jump', true)}
      <div class="continue-row">
        ${showLast ? `<a class="continue" href="#${last.book.slug}-${last.ch}"><span class="label">Where you left off</span>
          <strong>${esc(chapterName(last.book.book, last.ch))}</strong></a>` : ''}
        ${L ? `<a class="continue" href="#${L.slug}-${L.chapter}"><span class="label">Latest in the series</span>
          <strong>${esc(chapterName(L.book, L.chapter))}</strong><em>${esc(fmtDate(L.date))}</em></a>` : ''}
      </div>
      ${testament('OT', 'Old Testament', 'Genesis – Malachi')}
      ${testament('NT', 'New Testament', 'Matthew – Revelation')}`;
    // Each testament folds; the choice is remembered on this device.
    view.querySelectorAll('details.testament').forEach(d => d.addEventListener('toggle', () => {
      try { localStorage.setItem('wews_open_' + d.dataset.t, d.open ? '1' : '0'); } catch (e) {}
    }));
    wireJump(view, hash => { location.hash = hash; });
  }

  // Testaments start open; after that they stay the way they were left.
  function isOpen(t) {
    try { return localStorage.getItem('wews_open_' + t) !== '0'; } catch (e) { return true; }
  }

  function bookView(b) {
    document.title = b.book + ' — Chapter Studies';
    setCrumbs([['Home', '#'], [b.book, '#' + b.slug]]);
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
        <p>${n === b.chapters ? `All ${b.chapters} chapters studied` : `${n} of ${b.chapters} chapters studied`}</p>
      </div>
      <div class="section-header"><h2>Chapters</h2></div>
      <div class="legend">${legend}</div>
      <div class="chapter-grid">${cells}</div>`;
  }

  // ---------- about these studies (text in about.md) & tips ----------
  let ABOUT = null;
  function loadAbout() {
    return ABOUT ? Promise.resolve(ABOUT)
      : fetch('about.md').then(r => r.ok ? r.text() : '').then(t => (ABOUT = t)).catch(() => '');
  }

  const TIPS = [
    ['Jump to any chapter', 'Tap the chapter name at the top of a study (“Psalm 23 ▾”) to pick another chapter or book.'],
    ['Prev and Next', 'The buttons at the bottom of a study walk through the whole Bible. Press and hold one to skip past chapters not yet studied.'],
    ['Go to a chapter', 'Type a reference like “ps 23”, “1 cor 13” or “rev” in the Go to a chapter box.'],
    ['Back button', 'Your phone’s Back button closes the chapter picker first, then steps back through the pages you came from.'],
    ['Where you left off', 'The home page remembers the last study you opened on this device. Tap Old Testament or New Testament to fold its books away.'],
    ['Read in the KJV app', 'Opens that chapter in the KJV Bible app in a new tab, so your place here stays put.'],
    ['Doctrines & Teachings', 'Teachings that compare scripture with scripture, sorted by topic. Tap a verse to open it in the KJV Bible app, or open the chapter study it came from.'],
    ['Install the app', 'On Android choose Install app from the browser menu; on iPhone use Share, then Add to Home Screen. It then opens full screen like the KJV Bible app.'],
    ['Lessons & Classes', 'Slides, notes and handouts from the classes. Slides open in a new tab; notes open right on the page. Tap a meme to see it full size.'],
    ['Search', 'Tap the magnifying glass at the top to search every study, teaching and lesson. Type a verse like “john 3:16” to see everywhere it is taught.'],
    ['The chapter grid', 'Solid squares are series studies, dashed squares are earlier one-off studies, and dim squares are chapters not yet studied.']
  ];

  // ---------- install as an app (Android/desktop prompt; iPhone has no prompt, so say how) ----------
  let installPrompt = null;
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    installPrompt = e;
    const btn = document.getElementById('install-btn'), hint = document.getElementById('install-hint');
    if (btn) btn.hidden = false;
    if (hint) hint.hidden = true;
  });
  window.addEventListener('appinstalled', () => { installPrompt = null; if (location.hash === '#about') route(); });

  function installCard() {
    if (standalone()) return '';
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return `<div class="notice install">
      <strong>Install the app</strong>
      ${ios ? 'On iPhone or iPad, open this page in Safari, tap the Share button, then <b>Add to Home Screen</b>. It opens full screen, like the KJV Bible app.'
            : 'Put Chapter Studies on your home screen as its own app. It opens full screen, like the KJV Bible app, and keeps what you have read for when you are offline.'}
      ${ios ? '' : `<div class="actions"><button class="btn primary" type="button" id="install-btn"${installPrompt ? '' : ' hidden'}>Install the app</button></div>
      <p class="fineprint" id="install-hint"${installPrompt ? ' hidden' : ''}>If there's no button, use your browser's menu: <b>Install app</b> or <b>Add to Home screen</b>.</p>`}
    </div>`;
  }

  function wireInstall() {
    const btn = document.getElementById('install-btn');
    if (btn) btn.onclick = async () => {
      if (!installPrompt) return;
      installPrompt.prompt();
      await installPrompt.userChoice.catch(() => null);
      installPrompt = null;
      btn.hidden = true;
    };
  }

  async function aboutView() {
    document.title = 'About these studies — Jag\'s House of Wews';
    setCrumbs([['Home', '#'], ['About & tips', '#about']]);
    view.classList.remove('wide');
    const text = await loadAbout();
    if (location.hash !== '#about') return;
    view.innerHTML = `
      <div class="hero">
        <h1>About &amp; Tips</h1>
      </div>
      <div class="post about">${render(text)}</div>
      <div class="section-header"><h2>Getting around</h2></div>
      ${installCard()}
      <dl class="tips">${TIPS.map(([t, d]) => `<dt>${esc(t)}</dt><dd>${esc(d)}</dd>`).join('')}</dl>
      <p class="fineprint version">Version ${APP_VERSION} · ${esc(fmtDate(APP_DATE))}</p>`;
    wireInstall();
  }

  // First visit on this device: show the statement once. If the browser won't remember, don't nag.
  const welcome = document.createElement('div');
  welcome.className = 'sheet welcome';
  welcome.hidden = true;
  welcome.innerHTML = `<div class="sheet-backdrop" data-close></div>
    <div class="sheet-panel" role="dialog" aria-modal="true" aria-label="About these studies">
      <div class="post about" id="welcome-text"></div>
      <p class="actions">
        <button class="btn primary" type="button" data-close>Start reading</button>
        <a class="btn" href="#about" data-tips>Tips for getting around</a>
      </p>
    </div>`;
  document.body.appendChild(welcome);
  welcome.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) { e.preventDefault(); history.back(); }
    else if (e.target.closest('[data-tips]')) { e.preventDefault(); welcome.hidden = true; history.replaceState(null, '', '#about'); route(); }
  });
  window.addEventListener('popstate', () => { welcome.hidden = true; });

  async function maybeWelcome() {
    let seen;
    try { seen = localStorage.getItem('wews_welcomed'); localStorage.setItem('wews_welcomed', '1'); } catch (e) { return; }
    if (seen || location.hash === '#about') return;
    const text = await loadAbout();
    if (!text) return;
    welcome.querySelector('#welcome-text').innerHTML = render(text);
    welcome.hidden = false;
    history.pushState({ welcome: true }, '', location.href);   // Back closes it
    welcome.querySelector('[data-close].btn').focus({ preventScroll: true });
  }

  // ---------- doctrines & teachings ----------
  async function doctrinesView() {
    document.title = 'Doctrines & Teachings — Jag\'s House of Wews';
    setCrumbs([['Home', '#'], ['Doctrines & Teachings', '#doctrines']]);
    view.classList.add('wide');
    const t = await loadTopics();
    if (location.hash !== '#doctrines') return;
    const total = t.topics.reduce((n, x) => n + x.count, 0);
    view.innerHTML = `
      <div class="hero">
        <h1>Doctrines &amp; Teachings</h1>
        <p>Teachings where scripture is compared with scripture to set out one truth, gathered from the chapter studies and sorted by topic.</p>
      </div>
      <div class="topic-grid">${t.topics.filter(x => x.count).map(x => `
        <a class="topic" href="#doctrine-${esc(x.id)}">
          <span class="book-name">${esc(x.name)}</span>
          <span class="topic-about">${esc(x.about)}</span>
          <span class="book-count">${x.count} teaching${x.count === 1 ? '' : 's'}</span>
        </a>`).join('')}</div>
      <p class="fineprint">${total} entries. A teaching that sets out two doctrines is listed under both.</p>`;
  }

  function teachingHTML(x, open) {
    const refs = x.refs.map(r => {
      const href = kjvRefLink(r);
      return href ? `<a class="ref" href="${esc(href)}" target="_blank" rel="noopener">${esc(r)}</a>` : `<span class="ref">${esc(r)}</span>`;
    }).join('');
    const also = x.also.map(id => topicName(id) && `<a href="#doctrine-${esc(id)}">${esc(topicName(id))}</a>`).filter(Boolean);
    const from = x.book ? `${chapterName(x.book, x.ch)} study` : 'Standalone post';
    const studyLinks = x.book ? `<a class="btn" href="#${esc(x.slug)}-${x.ch}">Open the ${esc(chapterName(x.book, x.ch))} study →</a>`
      : (x.chapters || []).map(c => `<a class="btn" href="#${esc(c.slug)}-${c.ch}">${esc(chapterName(c.book, c.ch))} study →</a>`).join('');
    return `<details class="pass teaching" id="t${x.id}"${open ? ' open' : ''}>
      <summary><b>${esc(x.title)}</b><small>${esc(from)} · ${esc(fmtDate(x.date))}</small></summary>
      <div class="pass-body">
        <p class="teaching-sum">${esc(x.summary)}</p>
        ${refs ? `<div class="refs" aria-label="Scripture">${refs}</div>` : ''}
        <div class="post" data-lazy="${x.id}"></div>
        <p class="actions">
          ${studyLinks}
          ${x.link ? `<a class="btn" href="${esc(x.link)}" target="_blank" rel="noopener">View on Telegram ↗</a>` : ''}
        </p>
        ${also.length ? `<p class="filed">Also under ${also.join(' · ')}</p>` : ''}
      </div>
    </details>`;
  }

  async function topicView(id, openId, line) {
    const [t, topic, lib] = await Promise.all([loadTopics(), loadTopic(id), loadLessons()]);
    const onTopic = lib.lessons.filter(l => l.topics.includes(id));
    const pics = lib.pictures.filter(p => p.topics.includes(id));
    if (!location.hash.startsWith('#doctrine-' + id)) return;
    document.title = topic.name + ' — Doctrines & Teachings';
    setCrumbs([['Home', '#'], ['Doctrines', '#doctrines'], [topic.name, '#doctrine-' + id]]);
    view.classList.remove('wide');
    const groups = [];
    topic.teachings.forEach(x => {
      const name = x.theme || 'Also on this topic';
      let g = groups.find(gr => gr.name === name);
      if (!g) groups.push(g = { name, items: [] });
      g.items.push(x);
    });
    const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    view.innerHTML = `
      <div class="hero">
        <h1>${esc(topic.name)}</h1>
        <p>${esc(topic.about)}</p>
      </div>
      ${topic.timeline ? `<section class="timeline-card" aria-label="The order of events">
        <span class="label">The order of events</span>
        <ol class="timeline">${topic.timeline.map(item => {
          const step = typeof item === 'string' ? { step: item, refs: [] } : item;
          const refs = (step.refs || []).map(r => {
            const href = kjvRefLink(r);
            return href ? `<a class="ref" href="${esc(href)}" target="_blank" rel="noopener">${esc(r)}</a>` : `<span class="ref">${esc(r)}</span>`;
          }).join('');
          return `<li>${esc(step.step)}${refs ? `<span class="refs">${refs}</span>` : ''}</li>`;
        }).join('')}</ol>
        ${topic.chart ? `<p class="chart-link"><a href="${esc(topic.chart.url)}" target="_blank" rel="noopener">See the full chart: ${esc(topic.chart.label)} ↗</a></p>` : ''}</section>` : ''}
      ${onTopic.length ? `<div class="section-header"><h2>Lessons on this topic</h2><span>${onTopic.length}</span></div>
        <div class="lesson-list">${onTopic.map(lessonCard).join('')}</div>` : ''}
      ${pics.length ? `<div class="section-header"><h2>Memes</h2><span>${pics.length}</span></div>
        ${pictureGrid(pics)}` : ''}
      ${onTopic.length || pics.length ? `<div class="section-header"><h2>From the chapter studies</h2><span>${topic.teachings.length}</span></div>` : ''}
      ${groups.length > 1 ? `<nav class="theme-chips" aria-label="Themes">${groups.map(g =>
        `<a href="#doctrine-${esc(id)}" data-theme="${slugify(g.name)}">${esc(g.name)} <span>${g.items.length}</span></a>`).join('')}</nav>` : ''}
      ${groups.map(g => `<section id="theme-${slugify(g.name)}">
        <div class="section-header"><h2>${esc(g.name)}</h2><span>${g.items.length}</span></div>
        ${g.items.map(x => teachingHTML(x, false)).join('')}</section>`).join('')}`;
    // The full post is built when a teaching is opened, so a topic with hundreds stays quick.
    const byId = new Map(topic.teachings.map(x => [String(x.id), x]));
    view.querySelectorAll('details.teaching').forEach(d => d.addEventListener('toggle', () => {
      const slot = d.open && d.querySelector('[data-lazy]');
      if (slot && !slot.dataset.done) { slot.innerHTML = render(byId.get(slot.dataset.lazy).text); slot.dataset.done = '1'; }
    }));
    wirePictures(view, pics);
    // #doctrine-salvation~123 opens that teaching (linked from a chapter's "More teaching" list);
    // #doctrine-salvation~123~Some words goes on to that line in it and marks it
    const target = openId && document.getElementById('t' + openId);
    if (target) {
      target.open = true;
      const slot = target.querySelector('[data-lazy]');   // build its text now, so the line can be found
      if (slot && !slot.dataset.done) { slot.innerHTML = render(byId.get(slot.dataset.lazy).text); slot.dataset.done = '1'; }
      const want = line && line.toLowerCase();
      const at = want && [...target.querySelectorAll('p, blockquote, li')].find(el => el.textContent.toLowerCase().includes(want));
      if (at) at.classList.add('flash');
      requestAnimationFrame(() => (at || target).scrollIntoView({ block: at ? 'center' : 'start' }));
    }
    view.querySelectorAll('[data-theme]').forEach(a => a.onclick = e => {
      e.preventDefault();
      document.getElementById('theme-' + a.dataset.theme).scrollIntoView({ behavior: 'smooth' });
    });
  }

  // ---------- lessons & classes, and the teaching pictures ----------
  const PART_VERB = { page: 'Open', pdf: 'Open', notes: 'Read' };

  function lessonCard(l) {
    const kinds = [...new Set(l.parts.map(p => p.label))].join(' · ');
    return `<a class="lesson-card" href="#lesson-${esc(l.id)}">
      <span class="label">${esc(kinds)}</span>
      <strong>${esc(l.title)}</strong>
      ${l.summary ? `<em>${esc(l.summary)}</em>` : ''}
      ${l.by ? `<small>From ${esc(l.by)}</small>` : ''}
    </a>`;
  }

  function refChips(refs) {
    return refs.map(r => {
      const href = kjvRefLink(r);
      return href ? `<a class="ref" href="${esc(href)}" target="_blank" rel="noopener">${esc(r)}</a>` : `<span class="ref">${esc(r)}</span>`;
    }).join('');
  }

  function pictureGrid(pics) {
    return `<div class="pic-grid">${pics.map(p => `<button type="button" class="pic" data-pic="${esc(p.id)}" title="${esc(p.title)}">
      <img src="${esc(p.src)}" alt="${esc(p.alt || p.title)}" loading="lazy"${p.w ? ` width="${p.w}" height="${p.h}"` : ''}>
      <span>${esc(p.title)}</span></button>`).join('')}</div>`;
  }

  // A picture opens full size over the page; Back closes it.
  const viewer = document.createElement('div');
  viewer.className = 'sheet viewer';
  viewer.hidden = true;
  viewer.innerHTML = `<div class="sheet-backdrop" data-close></div>
    <figure class="viewer-panel" role="dialog" aria-modal="true" aria-label="Meme">
      <button class="sheet-x" type="button" data-close aria-label="Close">✕</button>
      <img alt="">
      <figcaption></figcaption>
    </figure>`;
  document.body.appendChild(viewer);
  viewer.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) { e.preventDefault(); history.back(); return; }
    const a = e.target.closest('a[href^="#"]');
    if (a) { e.preventDefault(); viewer.hidden = true; history.replaceState(null, '', a.getAttribute('href')); route(); }
  });
  viewer.addEventListener('keydown', e => { if (e.key === 'Escape') history.back(); });
  window.addEventListener('popstate', () => { viewer.hidden = true; });

  function openPicture(p) {
    viewer.querySelector('img').src = p.src;
    viewer.querySelector('img').alt = p.alt || p.title;
    const topics = p.topics.map(id => topicName(id) && `<a href="#doctrine-${esc(id)}">${esc(topicName(id))}</a>`).filter(Boolean);
    viewer.querySelector('figcaption').innerHTML = `<strong>${esc(p.title)}</strong>
      ${p.verses.length ? `<span class="refs">${refChips(p.verses)}</span>` : ''}
      ${topics.length ? `<span class="filed">Filed under ${topics.join(' · ')}</span>` : ''}
      <a class="btn" href="${esc(p.src)}" target="_blank" rel="noopener">Full size ↗</a>`;
    viewer.hidden = false;
    history.pushState({ viewer: true }, '', location.href);
    viewer.querySelector('.sheet-x').focus({ preventScroll: true });
  }

  function wirePictures(root, pics) {
    root.querySelectorAll('[data-pic]').forEach(btn => btn.onclick = () => {
      const p = pics.find(x => x.id === btn.dataset.pic);
      if (p) openPicture(p);
    });
  }

  // Shelves start folded, so the page reads as a list of what's there.
  function shelfOpen(id) {
    try { return localStorage.getItem('wews_shelf_' + id) === '1'; } catch (e) { return false; }
  }

  async function lessonsView() {
    document.title = 'Lessons & Classes — Jag\'s House of Wews';
    setCrumbs([['Home', '#'], ['Lessons & Classes', '#lessons']]);
    view.classList.add('wide');
    const [lib] = await Promise.all([loadLessons(), loadTopics()]);
    if (location.hash !== '#lessons') return;
    const shelves = lib.shelves.map(s => ({ ...s, items: lib.lessons.filter(l => l.shelf === s.id) })).filter(s => s.items.length);
    view.innerHTML = `
      <div class="hero">
        <h1>Lessons &amp; Classes</h1>
        <p>Slides, notes and handouts from the Sunday classes and other studies, and the memes. Each one is filed under its topics and the chapters it teaches on.</p>
      </div>
      ${lib.pictures.length ? `<nav class="theme-chips" aria-label="Memes"><a href="#pictures">Memes <span>${lib.pictures.length}</span></a></nav>` : ''}
      ${shelves.map(s => `<details class="shelf" id="shelf-${esc(s.id)}" data-shelf-id="${esc(s.id)}"${shelfOpen(s.id) ? ' open' : ''}>
        <summary class="section-header"><h2>${esc(s.name)}</h2><span>${s.items.length}</span>
          ${s.about ? `<em>${esc(s.about)}</em>` : ''}</summary>
        <div class="lesson-list">${s.items.map(lessonCard).join('')}</div></details>`).join('')}
`;
    // Each shelf folds; the choice is remembered on this device.
    view.querySelectorAll('details.shelf').forEach(d => d.addEventListener('toggle', () => {
      try { localStorage.setItem('wews_shelf_' + d.dataset.shelfId, d.open ? '1' : '0'); } catch (e) {}
    }));

  }

  async function lessonView(id) {
    const [lib] = await Promise.all([loadLessons(), loadTopics()]);
    if (location.hash !== '#lesson-' + id) return;
    const l = lib.lessons.find(x => x.id === id);
    if (!l) {   // a lesson replaced by another forwards to it
      const moved = (lib.moved || []).find(x => x.from === id);
      location.replace(moved ? '#lesson-' + moved.to : '#lessons');
      return;
    }
    const shelf = lib.shelves.find(s => s.id === l.shelf) || { name: 'Lessons' };
    document.title = l.title + ' — Lessons & Classes';
    setCrumbs([['Home', '#'], ['Lessons', '#lessons'], [l.title, '#lesson-' + id]]);
    view.classList.remove('wide');
    const opens = l.parts.filter(p => p.kind !== 'notes');
    const notes = l.parts.filter(p => p.kind === 'notes');
    const chapters = l.chapters.map(c => `<a class="btn" href="#${esc(c.slug)}-${c.ch}">${esc(chapterName(c.book, c.ch))} study →</a>`);
    view.innerHTML = `
      <div class="chapter-head">
        <span class="label">${esc(shelf.name)}</span>
        <h1 class="page-title">${esc(l.title)}</h1>
        ${l.by ? `<p class="by">From ${esc(l.by)}</p>` : ''}
        ${l.summary ? `<p class="teaching-sum">${esc(l.summary)}</p>` : ''}
        ${opens.length ? `<div class="actions">${opens.map((p, i) =>
          `<a class="btn${i ? '' : ' primary'}" href="${esc(p.href)}" target="_blank" rel="noopener">${PART_VERB[p.kind]} the ${esc(p.label.toLowerCase())} ↗</a>`).join('')}</div>` : ''}
        ${l.verses.length ? `<div class="refs" aria-label="Scripture">${refChips(l.verses)}</div>` : ''}
        ${filedUnder(l.topics)}
      </div>
      ${notes.map((p, i) => `<details class="pass notes"${i ? '' : ' open'}>
        <summary><b>${esc(p.label)}</b></summary>
        <div class="pass-body"><div class="post lesson-notes" data-notes="${esc(p.href)}"></div></div>
      </details>`).join('')}
      ${chapters.length ? `<div class="section-header"><h2>Chapter studies</h2></div><div class="actions">${chapters.join('')}</div>` : ''}`;
    // Notes are fetched when opened, so a lesson with a long handout stays quick.
    view.querySelectorAll('details.notes').forEach(d => {
      const fill = () => {
        const slot = d.querySelector('[data-notes]');
        if (!d.open || slot.dataset.done) return;
        slot.dataset.done = '1';
        slot.innerHTML = '<p class="loading">Loading…</p>';
        fetch(slot.dataset.notes).then(r => r.ok ? r.text() : Promise.reject(r.status))
          .then(html => { slot.innerHTML = html; })
          .catch(() => { slot.innerHTML = '<p class="error">These notes couldn\'t be loaded. Check your connection and try again.</p>'; delete slot.dataset.done; });
      };
      d.addEventListener('toggle', fill);
      fill();
    });
  }

  async function picturesView() {
    document.title = 'Memes — Lessons & Classes';
    setCrumbs([['Home', '#'], ['Lessons', '#lessons'], ['Memes', '#pictures']]);
    view.classList.add('wide');
    const [lib, t] = await Promise.all([loadLessons(), loadTopics()]);
    if (location.hash !== '#pictures') return;
    const groups = t.topics.map(x => ({ ...x, pics: lib.pictures.filter(p => p.topics[0] === x.id) })).filter(g => g.pics.length);
    view.innerHTML = `
      <div class="hero">
        <h1>Memes</h1>
        <p>Memes and charts, filed by topic. Tap one to see it full size.</p>
      </div>
      <nav class="theme-chips" aria-label="Topics">${groups.map(g =>
        `<a href="#pictures" data-shelf="${esc(g.id)}">${esc(g.name)} <span>${g.pics.length}</span></a>`).join('')}</nav>
      ${groups.map(g => `<section id="shelf-${esc(g.id)}">
        <div class="section-header"><h2><a href="#doctrine-${esc(g.id)}">${esc(g.name)}</a></h2><span>${g.pics.length}</span></div>
        ${pictureGrid(g.pics)}</section>`).join('')}`;
    wirePictures(view, lib.pictures);
    view.querySelectorAll('[data-shelf]').forEach(a => a.onclick = e => {
      e.preventDefault();
      document.getElementById('shelf-' + a.dataset.shelf).scrollIntoView({ behavior: 'smooth' });
    });
  }

  function kjvBlock(kjv, ch, fallbackStudy) {
    const chapter = kjv && kjv.chapters && kjv.chapters[ch - 1];
    if (chapter) {
      return chapter.verses.map(v =>
        `<div class="v"><span class="vnum">${esc(v.verse)}</span><span class="vtxt">${esc(v.text)}</span></div>`).join('');
    }
    const posts = fallbackStudy ? fallbackStudy.posts.filter(p => p.kind === 'scripture') : [];
    if (!posts.length) return '';
    return '<p class="from-post">Chapter text as posted on Telegram (the KJV Bible app couldn\'t be reached).</p>' +
      posts.map(p => `<div class="post">${render(p.text, true)}</div>`).join('');
  }

  // One tab per study of the chapter, newest first: "Oct 2023 · Series". A labelled tab gathers
  // teaching on this chapter from other studies until it gets a study of its own.
  const studyWhen = s => s.label ? 'From other studies' : fmtDate(s.date);

  function studyTab(s, i, on, base) {
    const when = new Date(s.date + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    return `<a href="${base}.${i + 1}" class="study-tab${on ? ' on' : ''}" data-study="${i}"${on ? ' aria-current="true"' : ''}>
      ${s.label ? `<b>${esc(s.label)}</b><small>From other studies</small>`
        : `<b>${esc(when)}</b><small>${s.series ? 'Series' : 'One-off'}${s.range ? ' · ' + esc(s.range) : ''}</small>`}</a>`;
  }

  async function chapterView(b, ch, pick) {
    const title = chapterName(b.book, ch);
    document.title = title + ' — Chapter Studies';
    setCrumbs([]);
    view.classList.remove('wide');
    view.innerHTML = '<p class="loading">Loading ' + esc(title) + '…</p>';
    setFab(b, ch);
    remember(b, ch);

    const [data, kjv, , lib] = await Promise.all([loadBook(b.slug), loadKJV(b.slug), loadTopics(), loadLessons()]);
    const base = `#${b.slug}-${ch}`;
    if (location.hash !== base && !location.hash.startsWith(base + '.')) return;   // moved on while loading
    const entry = data.studies[String(ch)] || { status: 'none' };
    const main = entry.main;
    // every study of this chapter, newest first (the cleaner already puts the newest series pass first)
    const studies = (main && entry.status !== 'with' ? [main] : []).concat(entry.others || [])
      .sort((x, y) => y.date.localeCompare(x.date));
    const home = Math.max(studies.indexOf(main), 0);             // the main study opens unless one is named
    let current = pick ? Math.min(Math.max(pick - 1, 0), Math.max(studies.length - 1, 0)) : home;
    const shownStudy = studies[current] || main;
    const kjvHref = kjvAppLink(b.book, ch);

    let tag = '', meta = '';
    if (entry.status === 'series') tag = '<span class="tag">Series study</span>';
    else if (entry.status === 'earlier') tag = '<span class="tag gold">Earlier study</span>';
    else if (entry.status === 'with') tag = '<span class="tag gold">Scripture</span>';
    else tag = '<span class="tag gold">Not yet studied</span>';
    if (main) meta = `<span>Posted ${esc(fmtDate(main.date))}${main.range ? ' · ' + esc(main.range) : ''}</span>`;
    if (studies.length > 1) meta += `<span>${studies.length} studies</span>`;

    // Class slides made for this chapter (its main chapter, listed first): one opens directly,
    // more than one jumps to the lessons list at the bottom.
    const decks = lib.lessons.filter(l => l.chapters[0] && l.chapters[0].slug === b.slug && l.chapters[0].ch === ch)
      .map(l => ({ l, part: l.parts.find(p => p.kind === 'page') })).filter(x => x.part);
    const slidesBtn = decks.length === 1
      ? `<a class="btn" href="${esc(decks[0].part.href)}" target="_blank" rel="noopener">Class slides ↗</a>`
      : decks.length ? `<a class="btn" href="#lessons-here" data-jump="lessons-here">Class slides (${decks.length}) ↓</a>` : '';
    const actions = `<div class="actions">
        <a class="btn primary" href="${esc(kjvHref)}" target="_blank" rel="noopener">Read in the KJV app ↗</a>
        ${shownStudy ? `<a class="btn" id="tg-link" href="${esc(shownStudy.link)}" target="_blank" rel="noopener">View on Telegram ↗</a>` : ''}
        ${slidesBtn}
        ${studies.length ? '<a class="btn" href="#commentary" data-jump="commentary">Skip to commentary ↓</a>' : ''}
      </div>`;

    let body = '';
    const hasKjv = !!(kjv && kjv.chapters[ch - 1]);
    const commentary = s => renderPosts(s.posts, s, { skipScripture: hasKjv, days: true });
    if (!main && !studies.length) {
      body += `<div class="notice"><strong>Not yet studied</strong>${esc(title)} hasn't had a study on the channel yet.</div>`;
    } else {
      const text = kjvBlock(kjv, ch, main || studies[0]);
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
      }
      if (studies.length) {
        body += `<div class="section-header" id="commentary"><h2>Commentary</h2><span id="study-date">${esc(studyWhen(shownStudy))}</span></div>
          ${studies.length > 1 || studies.some(x => x.label) ? `<nav class="study-tabs" aria-label="Studies of ${esc(title)}">${studies.map((s, i) => studyTab(s, i, i === current, base)).join('')}</nav>` : ''}
          <div id="commentary-body">${commentary(shownStudy)}</div>`;
      }
    }
    const moreHere = (data.more || {})[String(ch)] || [];
    if (moreHere.length) {
      body += `<div class="section-header"><h2>More teaching on ${esc(title)}</h2><span>${moreHere.length}</span></div>
        <div class="lesson-list">${moreHere.map(x => `<a class="lesson-card" href="#doctrine-${esc(x.topic)}~${x.id}">
          <span class="label">${esc(topicName(x.topic) || 'Teaching')} · ${esc(fmtDate(x.date))}</span><strong>${esc(x.title)}</strong></a>`).join('')}</div>`;
    }
    const onChapter = lib.lessons.filter(l => l.chapters.some(c => c.slug === b.slug && c.ch === ch));
    const chPics = lib.pictures.filter(p => p.chapters.some(c => c.slug === b.slug && c.ch === ch));
    if (onChapter.length || chPics.length) {
      body += `<div class="section-header" id="lessons-here"><h2>Lessons on ${esc(title)}</h2><span>${onChapter.length + chPics.length}</span></div>
        ${onChapter.length ? `<div class="lesson-list">${onChapter.map(lessonCard).join('')}</div>` : ''}
        ${chPics.length ? pictureGrid(chPics) : ''}`;
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
    wirePictures(view, chPics);
    const unfold = document.getElementById('unfold');
    if (unfold) unfold.onclick = () => { document.getElementById('kjv').classList.remove('folded'); unfold.remove(); };
    // Switching study swaps the commentary in place; the address (#Book-N.2) can be shared.
    view.querySelectorAll('[data-study]').forEach(tab => tab.onclick = e => {
      e.preventDefault();
      current = +tab.dataset.study;
      const s = studies[current];
      history.replaceState(null, '', current === home ? base : `${base}.${current + 1}`);
      view.querySelectorAll('[data-study]').forEach(t => {
        t.classList.toggle('on', t === tab);
        if (t === tab) t.setAttribute('aria-current', 'true'); else t.removeAttribute('aria-current');
      });
      document.getElementById('commentary-body').innerHTML = commentary(s);
      document.getElementById('study-date').textContent = studyWhen(s);
      const tg = document.getElementById('tg-link');
      if (tg) tg.href = s.link;
    });
    view.querySelectorAll('[data-jump]').forEach(jump => jump.onclick = e => {
      e.preventDefault();
      document.getElementById(jump.dataset.jump).scrollIntoView({ behavior: 'smooth' });
    });
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

  // The chapter box. With `find` (the home page) it also takes a verse or words: a chapter opens its
  // study, a verse shows everywhere it is taught, anything else is searched.
  function jumpBox(id, find) {
    return `<form class="jump" data-jump-form${find ? ' data-find' : ''}>
      <label for="${id}" class="label">${find ? 'Find a chapter, a verse or a word' : 'Go to a chapter'}</label>
      <div class="jump-row">
        <input id="${id}" type="${find ? 'search' : 'text'}" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false"
               placeholder="${find ? 'ps 23, john 3:16, propitiation' : 'ps 23, 1 cor 13, rev 1'}" aria-describedby="${id}-hint">
        <button class="btn primary" type="submit">${find ? 'Find' : 'Go'}</button>
      </div>
      <p class="jump-hint" id="${id}-hint" aria-live="polite"></p>
    </form>`;
  }

  function wireJump(root, onGo) {
    root.querySelectorAll('[data-jump-form]').forEach(form => {
      const input = form.querySelector('input'), hint = form.querySelector('.jump-hint');
      if (form.hasAttribute('data-find')) {
        // a word that only starts like a book ("am", "phil") is a search, not a book
        const chapterOf = v => {
          const r = parseRef(v);
          if (!r || /\d/.test(v)) return r;
          const key = v.toLowerCase().replace(/[\s.]+/g, '');
          return ALIASES[key] || r.book.book.toLowerCase().replace(/\s+/g, '') === key ? r : null;
        };
        const target = v => {
          const vr = verseRef(v);
          if (vr) return ['#search=' + encodeURIComponent(v), `→ ${chapterName(vr.book.book, vr.ch)}:${vr.from}: everywhere it is taught`];
          const r = chapterOf(v);
          if (r) return [r.ch ? `#${r.book.slug}-${r.ch}` : `#${r.book.slug}`, '→ ' + (r.ch ? chapterName(r.book.book, r.ch) : r.book.book)];
          return ['#search=' + encodeURIComponent(v), `→ Search for “${v}”`];
        };
        input.addEventListener('input', () => { const v = input.value.trim(); hint.textContent = v ? target(v)[1] : ''; });
        form.addEventListener('submit', e => {
          e.preventDefault();
          const v = input.value.trim(); if (!v) return;
          input.value = ''; hint.textContent = '';
          onGo(target(v)[0]);
        });
        return;
      }
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
    fab.classList.remove('scrolling', 'at-end');
    fab.hidden = false;
  }

  // Keep the page clear of the tab bar at whatever height it really is (big system text, full-screen browsing).
  const tabbar = document.getElementById('tabbar');
  const fitTabbar = () => document.body.style.setProperty('--tab-real', tabbar.offsetHeight + 'px');
  fitTabbar();
  if ('ResizeObserver' in window) new ResizeObserver(fitTabbar).observe(tabbar);
  window.addEventListener('resize', fitTabbar);

  // Prev/Next fade out while scrolling and at the end of a study, where the pager links are.
  let scrollTimer = null;
  window.addEventListener('scroll', () => {
    if (fab.hidden) return;
    fab.classList.add('scrolling');
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      fab.classList.remove('scrolling');
      const pager = document.querySelector('.pager');
      fab.classList.toggle('at-end', !!pager && pager.getBoundingClientRect().top < innerHeight);
    }, 450);
  }, { passive: true });

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

  // ---------- theme: shared with the KJV Bible app (kjv_theme on this site) ----------
  const THEMES = ['dark', 'light', 'sepia'];
  const THEME_BG = { dark: '#1a1005', light: '#ede5d5', sepia: '#e7d9be' };
  function currentTheme() {
    try { const t = JSON.parse(localStorage.getItem('kjv_theme') || '"dark"'); return THEMES.includes(t) ? t : 'dark'; }
    catch (e) { return 'dark'; }
  }
  function applyTheme(t) {
    document.documentElement.className = t === 'dark' ? '' : t;
    document.getElementById('theme-color-meta').content = THEME_BG[t];
    document.getElementById('theme-btn').setAttribute('aria-label', 'Theme: ' + t + '. Tap for ' + THEMES[(THEMES.indexOf(t) + 1) % 3]);
  }
  let theme = currentTheme();
  applyTheme(theme);
  document.getElementById('theme-btn').addEventListener('click', () => {
    theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    try { localStorage.setItem('kjv_theme', JSON.stringify(theme)); } catch (e) { /* storage blocked: this visit only */ }
    applyTheme(theme);
  });
  // Changing the theme in the Bible app (another tab) changes it here too.
  window.addEventListener('storage', e => { if (e.key === 'kjv_theme') applyTheme(theme = currentTheme()); });

  // ---------- How to know for sure you're going to Heaven (text in heaven.html) ----------
  let HEAVEN = null;
  async function heavenView() {
    document.title = 'How to know for sure you\'re going to Heaven — Jag\'s House of Wews';
    setCrumbs([['Home', '#'], ['Going to Heaven', '#heaven']]);
    view.classList.remove('wide');
    HEAVEN = HEAVEN || await fetch('heaven.html', { cache: 'no-cache' }).then(r => r.ok ? r.text() : '').catch(() => '');
    if (location.hash !== '#heaven') return;
    view.innerHTML = `
      <div class="hero"><span class="label">The gospel</span><h1>How to know for sure you’re going to Heaven</h1></div>
      <div class="post gospel">${HEAVEN || '<p class="error">This page couldn\'t be loaded. Check your connection and try again.</p>'}</div>`;
  }

  // ---------- search: words anywhere, or a verse ("john 3:16") to see everywhere it is taught ----------
  let SEARCH = null;
  function loadSearch() {
    return SEARCH || (SEARCH = getJSON('data/search.json').then(d => {
      d.items.forEach(it => { it.lc = (it[2] + ' ' + it[4]).toLowerCase(); });
      return d;
    }).catch(e => { SEARCH = null; throw e; }));
  }
  const KIND = { s: 'Study', t: 'Teaching', l: 'Lesson' };

  // "rom 10:9", "1 John 5:11-13" -> { book, ch, from, to }
  function verseRef(q) {
    const m = String(q).trim().match(/^(.*?\S)\s*(\d+)\s*:\s*(\d+)(?:\s*[-–]\s*(\d+))?$/);
    if (!m) return null;
    const r = parseRef(m[1] + ' ' + m[2]);
    if (!r || !r.ch) return null;
    const from = +m[3], to = Math.max(from, Math.min(+(m[4] || m[3]), from + 30));
    return { book: r.book, ch: r.ch, from, to };
  }

  function snippet(text, words, at) {
    const lc = text.toLowerCase();
    let i = at != null ? at : Math.min(...words.map(w => lc.indexOf(w)).filter(x => x >= 0), Infinity);
    if (!isFinite(i)) i = 0;
    const start = Math.max(0, text.lastIndexOf(' ', Math.max(0, i - 90)) + 1), end = Math.min(text.length, i + 170);
    let out = esc((start ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : ''));
    words.filter(w => w.length > 1).forEach(w => {
      out = out.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>');
    });
    return out;
  }

  function resultCard(it, words, at) {
    const meta = [KIND[it[0]], it[0] === 's' ? it[5] : null, it[3] ? fmtDate(it[3]) : null].filter(Boolean).join(' · ');
    return `<a class="lesson-card result" href="${esc(it[1])}"><span class="label">${esc(meta)}</span>
      <strong>${esc(it[2])}</strong><span class="snip">${snippet(it[4], words, at)}</span></a>`;
  }

  let searchKind = '', searchShown = 30;
  async function searchView(q) {
    document.title = 'Search — Jag\'s House of Wews';
    setCrumbs([['Home', '#'], ['Search', '#search']]);
    view.classList.remove('wide');
    if (!document.getElementById('search-q')) {
      view.innerHTML = `
        <div class="hero"><h1>Search</h1><p>Words or a verse, across every study, teaching and lesson.</p></div>
        <form class="jump" id="search-form" role="search">
          <label for="search-q" class="label">Search</label>
          <div class="jump-row">
            <input id="search-q" type="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="propitiation, john 3:16, rom 10:9">
            <button class="btn primary" type="submit">Search</button>
          </div>
        </form>
        <nav class="theme-chips" id="search-kinds" aria-label="Show">${[['', 'All'], ['s', 'Studies'], ['t', 'Teachings'], ['l', 'Lessons']]
          .map(([k, n]) => `<a href="#search" data-kind="${k}"${k === searchKind ? ' class="on"' : ''}>${n}</a>`).join('')}</nav>
        <div id="search-results"><p class="loading">Loading the index…</p></div>`;
      const input = document.getElementById('search-q');
      input.value = q;
      let t = null;
      const run = () => {
        const v = input.value.trim();
        history.replaceState(null, '', v ? '#search=' + encodeURIComponent(v) : '#search');
        searchShown = 30; showResults(v);
      };
      input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 250); });
      document.getElementById('search-form').onsubmit = e => { e.preventDefault(); clearTimeout(t); run(); input.blur(); };
      view.querySelectorAll('[data-kind]').forEach(a => a.onclick = e => {
        e.preventDefault(); searchKind = a.dataset.kind; searchShown = 30;
        view.querySelectorAll('[data-kind]').forEach(x => x.classList.toggle('on', x === a));
        showResults(input.value.trim());
      });
      if (!q) input.focus();
    }
    await showResults(q);
  }

  async function showResults(q) {
    const box = document.getElementById('search-results');
    if (!box) return;
    if (!q) { box.innerHTML = '<p class="fineprint">Type a word or two, or a reference like “john 3:16”. A verse lists everywhere it is taught.</p>'; return; }
    let data;
    try { data = await loadSearch(); } catch (e) { box.innerHTML = '<p class="error">Search couldn\'t be loaded. Check your connection and try again.</p>'; return; }
    if (document.getElementById('search-q') && document.getElementById('search-q').value.trim() !== q) return;
    const pick = it => !searchKind || it[0] === searchKind;
    const vr = verseRef(q);
    if (vr) {
      const keys = []; for (let v = vr.from; v <= vr.to; v++) keys.push(`${vr.book.book} ${vr.ch}:${v}`);
      const ids = [...new Set(keys.flatMap(k => data.verses[k] || []))];
      const hits = ids.map(i => data.items[i]).filter(pick).sort((a, b) => (b[3] || '').localeCompare(a[3] || ''));
      const label = `${chapterName(vr.book.book, vr.ch)}:${vr.from}${vr.to > vr.from ? '–' + vr.to : ''}`;
      const kjv = await loadKJV(vr.book.slug);
      if (document.getElementById('search-q') && document.getElementById('search-q').value.trim() !== q) return;   // typed on meanwhile
      const chap = kjv && kjv.chapters[vr.ch - 1];
      const text = chap ? chap.verses.filter(v => +v.verse >= vr.from && +v.verse <= vr.to).map(v => esc(v.text)).join(' ') : '';
      const needle = new RegExp(`${vr.book.book.replace(/^Psalms$/, 'Psalms?')}\\.?\\s+${vr.ch}:${vr.from}\\b`, 'i');
      box.innerHTML = `${text ? `<blockquote class="quote"><cite>${esc(label)}</cite>${text}</blockquote>` : ''}
        <div class="section-header"><h2>${esc(label)} is taught in</h2><span>${hits.length}</span></div>
        <p class="actions"><a class="btn" href="#${vr.book.slug}-${vr.ch}">Go to the ${esc(chapterName(vr.book.book, vr.ch))} study →</a></p>
        <div class="lesson-list">${hits.slice(0, searchShown).map(it => {
          const m = it[4].match(needle); return resultCard(it, [], m ? m.index : 0);
        }).join('') || '<p class="fineprint">No study, teaching or lesson cites this verse yet.</p>'}</div>
        ${hits.length > searchShown ? '<p class="center"><button class="btn" id="more">Show more</button></p>' : ''}`;
    } else {
      const phrase = q.match(/^"(.+)"$/);
      const words = phrase ? [phrase[1].toLowerCase()] : q.toLowerCase().split(/\s+/).filter(w => w.length > 1);
      const scored = [];
      for (const it of data.items) {
        if (!pick(it) || !words.every(w => it.lc.includes(w))) continue;
        let score = 0;
        for (const w of words) {
          if (it[2].toLowerCase().includes(w)) score += 20;
          let i = -1, n = 0; while ((i = it.lc.indexOf(w, i + 1)) >= 0 && n < 20) n++;
          score += n;
        }
        scored.push([score, it]);
      }
      scored.sort((a, b) => b[0] - a[0] || (b[1][3] || '').localeCompare(a[1][3] || ''));
      const rc = parseRef(q);
      box.innerHTML = `${rc && rc.ch ? `<p class="actions"><a class="btn" href="#${rc.book.slug}-${rc.ch}">Go to the ${esc(chapterName(rc.book.book, rc.ch))} study →</a></p>` : ''}
        <div class="section-header"><h2>Results</h2><span>${scored.length}</span></div>
        <div class="lesson-list">${scored.slice(0, searchShown).map(([, it]) => resultCard(it, words)).join('') ||
          '<p class="fineprint">Nothing found. Try fewer words, or a different spelling.</p>'}</div>
        ${scored.length > searchShown ? '<p class="center"><button class="btn" id="more">Show more</button></p>' : ''}`;
    }
    const more = document.getElementById('more');
    if (more) more.onclick = () => { searchShown += 30; showResults(q); };
  }

  function markTab(h) {
    const tab = h === 'about' || h === 'heaven' || h.startsWith('search') ? '' : (h === 'doctrines' || h.startsWith('doctrine-')) ? 'doctrines'
      : (h === 'lessons' || h === 'pictures' || h.startsWith('lesson-')) ? 'lessons' : 'books';
    document.getElementById('about-btn').classList.toggle('on', h === 'about');
    document.getElementById('search-btn').classList.toggle('on', h.startsWith('search'));
    document.querySelectorAll('#tabbar .tab[data-tab]').forEach(a => {
      a.classList.toggle('on', a.dataset.tab === tab);
      if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  // ---------- router: (empty)  #Psalms  #Psalms-23  #doctrines  #doctrine-x  #lessons  #lesson-x  #pictures ----------
  async function route() {
    const h = decodeURIComponent(location.hash.slice(1));
    markTab(h);
    try {
      if (!INDEX) INDEX = await getJSON('data/books.json');
      if (!sheet.hidden) hideSheet();
      viewer.hidden = true;
      fab.hidden = true;
      if (h === 'about') { await aboutView(); window.scrollTo(0, 0); return; }
      if (h === 'heaven') { await heavenView(); window.scrollTo(0, 0); return; }
      if (h === 'search' || h.startsWith('search=')) { await searchView(h.slice(7)); return; }
      if (h === 'doctrines') { await doctrinesView(); window.scrollTo(0, 0); return; }
      if (h === 'lessons') { await lessonsView(); window.scrollTo(0, 0); return; }
      if (h === 'pictures') { await picturesView(); window.scrollTo(0, 0); return; }
      const lm = h.match(/^lesson-([a-z0-9-]+)$/);
      if (lm) { await lessonView(lm[1]); window.scrollTo(0, 0); return; }
      const dm = h.match(/^doctrine-([a-z0-9-]+?)(?:~(\d+))?(?:~(.+))?$/);
      if (dm) { window.scrollTo(0, 0); await topicView(dm[1], dm[2], dm[3]); return; }
      const m = h.match(/^([A-Za-z0-9]+)(?:-(\d+)(?:\.(\d+))?)?$/);   // #Book, #Book-N, #Book-N.2 (second study)
      if (!m) { home(); }
      else {
        const b = bookBySlug(m[1]);
        const ch = m[2] ? parseInt(m[2], 10) : null;
        if (!b) home();
        else if (ch === null) bookView(b);
        else if (ch >= 1 && ch <= b.chapters) await chapterView(b, ch, m[3] ? parseInt(m[3], 10) : 0);
        else { location.hash = b.slug; return; }
      }
      window.scrollTo(0, 0);
    } catch (e) {
      console.error(e);
      view.innerHTML = '<p class="error">This page couldn\'t be loaded. Check your connection and try again.</p>';
    }
  }

  document.getElementById('foot-version').textContent = 'v' + APP_VERSION;
  window.addEventListener('hashchange', route);
  route().then(maybeWelcome);

  // Offline: keep what's been opened, always prefer the network when it's there.
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
  }
})();
