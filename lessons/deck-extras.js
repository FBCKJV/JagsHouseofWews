/* Shared by every lesson page: remembers where you stopped, and adds a Share button that copies a link.
   Loaded in the page <head> so the saved slide is in the address before the page reads it.
   Slide decks also get two switches, each remembered for every deck:
   - Projector (button or P): sturdier type, the strongest contrast, and each slide grown to fill the screen,
     for a cheap projector on a wall in a half-lit room.
   - Day / Night (button or D): Night is bright words on a dark screen (the usual look); Day is dark words on a
     light page. */
(function () {
  var PKEY = 'kjv_projector', DKEY = 'kjv_deck_day';
  var proj = false, day = false;
  try { proj = localStorage.getItem(PKEY) === '1'; day = localStorage.getItem(DKEY) === '1'; } catch (e) {}
  if (/[?&]projector=1\b/.test(location.search)) proj = true;
  var root = document.documentElement;

  /* Crimson Pro (the KJV Bible app's reading face) has firm strokes that survive a dim projector;
     the deck's Cormorant hairlines do not. Loaded only when Projector is first used. */
  var fontLoaded = false;
  function loadFont() {
    if (fontLoaded) return; fontLoaded = true;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,500;0,600;0,700;1,500;1,600&display=swap';
    document.head.appendChild(l);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fit(); });
  }

  var pcss = document.createElement('style');
  pcss.textContent =
    /* Day: dark words on a light page */
    'html.day{color-scheme:light;--ink:#fffdf7;--ink-2:#f4ecda;--vellum:#111;--vellum-dim:#3b3126;--gold:#6e4600;' +
    '--gold-bright:#5c0f12;--crimson:#a3171c;--lapis:#1f4fa0;--lapis-text:#1f4fa0;--rule:rgba(92,60,18,.5)}' +
    'html.day body{background:#fffdf7}' +
    'html.day .page{background:#fffdf7}' +
    'html.day .vp,html.day .panel,html.day .lineage span,html.day .tally div,html.day .dims div,html.day .timeline div,html.day .chart th{background:#f4ecda}' +
    'html.day .callout,html.day ol.order li.focus{background:#f8e4df}' +
    'html.day .callout.honest,html.day .chart td.angels{background:#e4ebf7}' +
    'html.day .title-page h1{text-shadow:none}' +
    'html.day mark{color:#5c0f12}' +
    'html.day .sub,html.day .hint{color:#3b3126}' +
    'html.day .lead::first-letter{color:#fff}' +
    'html.day .toc-list .sec{color:#a3171c}' +
    'html.day .bar{background:#f4ecda;color:#3b3126}' +
    'html.day .bar .nav button{background:#fffdf7;color:#111}' +
    'html.day dialog::backdrop{background:rgba(40,30,15,.45)}' +
    'html.day .xshare{background:#fffdf7;color:#5c0f12;border-color:#6e4600}' +
    /* Projector at night: pure black, near-white words, bright gold, no soft gradients */
    'html.proj:not(.day){--ink:#000;--ink-2:#111;--vellum:#fff;--vellum-dim:#f0f0f0;--gold:#ffcf4a;--gold-bright:#ffdd73;' +
    '--crimson:#ff4b4b;--lapis-text:#9fc3ff;--rule:rgba(255,207,74,.7)}' +
    'html.proj:not(.day) body{background:#000}' +
    'html.proj:not(.day) .page{background:#000}' +
    'html.proj:not(.day) .vp,html.proj:not(.day) .panel,html.proj:not(.day) .lineage span,html.proj:not(.day) .tally div,html.proj:not(.day) .dims div,html.proj:not(.day) .timeline div{background:#141414}' +
    'html.proj:not(.day) .title-page h1{text-shadow:none}' +
    'html.proj:not(.day) .lead::first-letter{color:#fff;background:#a3171c}' +
    'html.proj:not(.day) .bar{background:#000}' +
    /* Projector, day or night: sturdier type, larger, heavier, and the slide filling the screen */
    'html.proj body,html.proj .scripture,html.proj blockquote,html.proj .dlg-body p{font-family:"Crimson Pro",var(--body)}' +
    'html.proj body{font-weight:500}' +
    'html.proj .slide{padding-left:2.5vw;padding-right:2.5vw;padding-top:calc(env(safe-area-inset-top,0px) + 50px)}' +
    'html.proj .page,html.proj .page.wide{max-width:min(96vw,175vh);background-image:none}' +
    'html.proj h2{font-size:1.7em;font-weight:700}' +
    'html.proj h3{font-size:1.15em;font-weight:700}' +
    'html.proj .title-page h1{font-size:3.4em}' +
    'html.proj .title-page.later h1{font-size:2.6em}' +
    'html.proj .pic img{max-height:62vh}' +
    'html.proj blockquote{font-weight:500}' +
    'html.proj blockquote cite,html.proj .title-page .overline,html.proj .scripture sup{font-weight:700}' +
    'html.proj mark{font-weight:700;border-bottom-width:3px}' +
    'html.proj .kicker{font-size:.8em;font-weight:700}' +
    'html.proj .ref{font-size:.8em;font-weight:700}' +
    'html.proj .sub{font-weight:500}' +
    '@media (max-width:700px){.xproj{display:none}}';
  document.head.appendChild(pcss);
  if (proj) { root.classList.add('proj'); loadFont(); }
  if (day) root.classList.add('day');

  /* Grow the shown slide's text as large as the screen allows without scrolling. */
  var fitQueued = false;
  function fitNow() {
    fitQueued = false;
    var s = document.querySelector('.slide.active'), pg = s && s.querySelector('.page');
    if (!pg) return;
    function over() { return s.scrollHeight > s.clientHeight + 1 || s.scrollWidth > s.clientWidth + 1; }
    /* A picture with words beside it gives up height, a step at a time, before the slide would scroll
       (on a computer, TV or projector; a phone scrolls as usual). Tap the picture to see it full size. */
    function shrinkPics() {
      var ims = s.querySelectorAll('.pic img');
      ims.forEach(function (im) { im.style.maxHeight = ''; });
      if (!ims.length || innerWidth < 700 || !over()) return;
      for (var vh = 60; vh >= 25; vh -= 5) {
        ims.forEach(function (im) { im.style.maxHeight = (vh / ims.length) + 'vh'; });
        if (!over()) return;
      }
    }
    if (!proj) { pg.style.fontSize = ''; shrinkPics(); return; }
    /* Never smaller than can be read from the back of the room: a crowded chart scrolls instead. */
    var lo = Math.max(16, Math.min(innerHeight * 0.024, innerWidth * 0.018)), hi = Math.max(lo, Math.min(innerHeight * 0.05, innerWidth * 0.03));
    function fits(px) { pg.style.fontSize = px + 'px'; return !over(); }
    s.querySelectorAll('.pic img').forEach(function (im) { im.style.maxHeight = ''; });
    if (fits(hi)) return;
    for (var i = 0; i < 9; i++) { var m = (lo + hi) / 2; if (fits(m)) lo = m; else hi = m; }
    if (!fits(lo)) shrinkPics();
  }
  function fit() { if (!fitQueued) { fitQueued = true; requestAnimationFrame(fitNow); } }
  function setProj(on) {
    proj = on;
    if (on) loadFont();
    root.classList.toggle('proj', on);
    try { localStorage.setItem(PKEY, on ? '1' : '0'); } catch (e) {}
    document.querySelectorAll('.slide .page').forEach(function (p) { p.style.fontSize = ''; });
    var b = document.querySelector('.xproj');
    if (b) { b.textContent = on ? 'Projector ✓' : 'Projector'; b.setAttribute('aria-pressed', String(on)); }
    fit();
  }
  function setDay(on) {
    day = on;
    root.classList.toggle('day', on);
    try { localStorage.setItem(DKEY, on ? '1' : '0'); } catch (e) {}
    var b = document.querySelector('.xday');
    if (b) { b.textContent = on ? '☾ Night' : '☀ Day'; b.title = (on ? 'Bright words on a dark screen' : 'Dark words on a light page') + ' (key D)'; }
  }

  var KEY = 'kjv_resume:' + location.pathname;
  function read() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function write(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) {} }

  var saved = read(), slide = 0, total = 0, resumed = '';
  var mark = history.replaceState;
  var startsOn = /^#\d+$/.test(location.hash);

  /* Slide decks keep the slide number in the address (#7). Watch it, and reopen on it. */
  if (!startsOn && saved && saved.s > 1 && (!saved.t || saved.s < saved.t)) {
    mark.call(history, null, '', location.pathname + location.search + '#' + saved.s);
    resumed = 'slide ' + saved.s;
    slide = saved.s;
  }
  history.replaceState = function (st, t, url) {
    var r = mark.apply(this, arguments);
    var m = /#(\d+)$/.exec(String(url || ''));
    if (m) { slide = +m[1]; write({ s: slide, t: total }); }
    fit();
    return r;
  };

  document.addEventListener('DOMContentLoaded', function () {
    total = document.querySelectorAll('.slide').length;
    if (slide) write({ s: slide, t: total });

    /* Pages with no slides scroll like a document: remember how far down. */
    if (!total) {
      if (!startsOn && !location.hash && saved && saved.y > 300) {
        addEventListener('load', function () { scrollTo(0, saved.y); });
        resumed = 'where you left off';
      }
      var tick;
      addEventListener('scroll', function () {
        clearTimeout(tick);
        tick = setTimeout(function () { write({ y: Math.round(scrollY) }); }, 400);
      }, { passive: true });
    }

    var css = document.createElement('style');
    css.textContent =
      '.xshare,.xtoast{font:600 12px/1 system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#ecc969;' +
      'background:rgba(20,15,10,.82);border:1px solid rgba(201,162,75,.65);border-radius:2px;z-index:50}' +
      '.xtools{position:fixed;top:calc(env(safe-area-inset-top,0px) + 10px);left:10px;display:flex;gap:8px;z-index:50}' +
      '.xshare{padding:8px 10px;cursor:pointer}' +
      '.xshare:hover{color:#fff}' +
      '.xtoast{position:fixed;left:50%;bottom:76px;transform:translateX(-50%);padding:10px 14px;max-width:92vw;text-transform:none;letter-spacing:0;font-size:14px;line-height:1.35}' +
      '.xtoast button{margin-left:10px;background:none;border:0;border-bottom:1px solid currentColor;color:inherit;font:inherit;cursor:pointer;padding:0}' +
      '@media print{.xtools,.xtoast{display:none}}';
    document.head.appendChild(css);

    var b = document.createElement('button');
    b.type = 'button'; b.className = 'xshare'; b.textContent = 'Share';
    b.setAttribute('aria-label', 'Copy a link to this lesson');
    b.addEventListener('click', function () {
      var url = location.href, label = 'Share';
      function done(msg) { b.textContent = msg; setTimeout(function () { b.textContent = label; }, 1800); }
      if (navigator.share && matchMedia('(pointer:coarse)').matches) {
        navigator.share({ title: document.title, url: url }).catch(function () {});
        return;
      }
      function fallback() {
        var t = document.createElement('textarea');
        t.value = url; t.style.position = 'fixed'; t.style.opacity = '0';
        document.body.appendChild(t); t.select();
        try { document.execCommand('copy'); done('Link copied'); } catch (e) { done('Copy failed'); }
        t.remove();
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { done('Link copied'); }, fallback);
      } else fallback();
    });
    var bar = document.createElement('div');
    bar.className = 'xtools';
    document.body.appendChild(bar);

    /* In the installed app there is no browser Back on iPhone: give a way home. */
    var inApp = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    if (inApp && history.length > 1) {
      var back = document.createElement('button');
      back.type = 'button'; back.className = 'xshare'; back.textContent = '‹ Back';
      back.setAttribute('aria-label', 'Go back');
      back.addEventListener('click', function () { history.back(); });
      bar.appendChild(back);
    }
    bar.appendChild(b);

    if (total) {
      /* Full screen hides the browser's bar and the phone's own bars (not offered where the browser can't, as on iPhone). */
      var root = document.documentElement;
      var canFull = !!(root.requestFullscreen || root.webkitRequestFullscreen);
      function isFull() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
      function toggleFull() {
        if (isFull()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
        var r = (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
        if (r && r.catch) r.catch(function () {});
      }
      if (canFull) {
        var fb = document.createElement('button');
        fb.type = 'button'; fb.className = 'xshare';
        var label = function () { fb.textContent = isFull() ? 'Exit full screen' : 'Full screen'; };
        label();
        fb.title = 'Fill the whole screen (key F)';
        fb.addEventListener('click', function () { toggleFull(); fb.blur(); });
        document.addEventListener('fullscreenchange', function () { label(); fit(); });
        document.addEventListener('webkitfullscreenchange', function () { label(); fit(); });
        bar.appendChild(fb);
      }

      var pb = document.createElement('button');
      pb.type = 'button'; pb.className = 'xshare xproj';
      pb.title = 'Projector: sturdier type and the strongest contrast, as large as the screen allows (key P)';
      pb.addEventListener('click', function () { setProj(!proj); pb.blur(); });
      bar.appendChild(pb);
      var db = document.createElement('button');
      db.type = 'button'; db.className = 'xshare xday';
      db.addEventListener('click', function () { setDay(!day); db.blur(); });
      bar.appendChild(db);
      setProj(proj);
      setDay(day);
      addEventListener('resize', function () { document.querySelectorAll('.slide .page').forEach(function (p) { p.style.fontSize = ''; }); fit(); });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
      addEventListener('load', fit);
      /* Pictures load when their slide is shown: size the slide again once one arrives. */
      document.addEventListener('load', function (e) { if (e.target && e.target.tagName === 'IMG') fit(); }, true);
      document.addEventListener('keydown', function (e) {
        if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
        if (e.key === 'p' || e.key === 'P') { setProj(!proj); }
        else if (e.key === 'd' || e.key === 'D') { setDay(!day); }
        else if ((e.key === 'f' || e.key === 'F') && canFull) { toggleFull(); }
      });
    }

    if (resumed) {
      var t = document.createElement('div');
      t.className = 'xtoast'; t.setAttribute('role', 'status');
      t.appendChild(document.createTextNode('Continuing from ' + resumed + '.'));
      var s = document.createElement('button');
      s.type = 'button'; s.textContent = 'Start over';
      s.addEventListener('click', function () {
        clear();
        if (slide) { mark.call(history, null, '', location.pathname + location.search + '#1'); location.reload(); }
        else { scrollTo(0, 0); t.remove(); }
      });
      t.appendChild(s);
      document.body.appendChild(t);
      setTimeout(function () { t.remove(); }, 7000);
    }
  });
})();
