/* Shared by every lesson page: remembers where you stopped, and adds a Share button that copies a link.
   Loaded in the page <head> so the saved slide is in the address before the page reads it.
   Slide decks also get Projector mode (the button, or the P key): dark text on a light page and each slide
   grown to fill the screen, for a dim projector in a lit room. It is remembered for every deck. */
(function () {
  /* ---------- Projector mode ---------- */
  var PKEY = 'kjv_projector';
  var proj = false;
  try { proj = localStorage.getItem(PKEY) === '1'; } catch (e) {}
  if (/[?&]projector=1\b/.test(location.search)) proj = true;
  var pcss = document.createElement('style');
  pcss.textContent =
    'html.proj{color-scheme:light;--ink:#fffdf7;--ink-2:#f4ecda;--vellum:#111;--vellum-dim:#3b3126;--gold:#6e4600;' +
    '--gold-bright:#5c0f12;--crimson:#a3171c;--lapis:#1f4fa0;--lapis-text:#1f4fa0;--rule:rgba(92,60,18,.5)}' +
    'html.proj body{background:#fffdf7;font-weight:500}' +
    'html.proj .slide{padding-left:2.5vw;padding-right:2.5vw;padding-top:calc(env(safe-area-inset-top,0px) + 50px)}' +
    'html.proj .page,html.proj .page.wide{max-width:min(96vw,175vh);background:#fffdf7}' +
    'html.proj .vp,html.proj .panel,html.proj .lineage span,html.proj .tally div,html.proj .dims div,html.proj .timeline div,html.proj .chart th{background:#f4ecda}' +
    'html.proj .callout,html.proj ol.order li.focus{background:#f8e4df}' +
    'html.proj .callout.honest,html.proj .chart td.angels{background:#e4ebf7}' +
    'html.proj h2{font-size:1.75em;font-weight:700}' +
    'html.proj h3{font-size:1.15em;font-weight:700}' +
    'html.proj .title-page h1{font-size:3.4em;text-shadow:none}' +
    'html.proj .title-page.later h1{font-size:2.6em}' +
    'html.proj blockquote{font-weight:500}' +
    'html.proj mark{font-weight:600;color:#5c0f12}' +
    'html.proj .kicker{font-size:.8em;font-weight:600}' +
    'html.proj .ref{font-size:.8em;font-weight:600}' +
    'html.proj .sub,html.proj .hint{color:#3b3126}' +
    'html.proj .lead::first-letter{color:#fff}' +
    'html.proj .toc-list .sec{color:#a3171c}' +
    'html.proj .bar{background:#f4ecda;color:#3b3126}' +
    'html.proj .bar .nav button{background:#fffdf7;color:#111}' +
    'html.proj .xshare{background:#fffdf7;color:#5c0f12;border-color:#6e4600}' +
    '@media (max-width:700px){.xproj{display:none}}';
  document.head.appendChild(pcss);
  if (proj) document.documentElement.classList.add('proj');

  /* Grow the shown slide's text as large as the screen allows without scrolling. */
  var fitQueued = false;
  function fitNow() {
    fitQueued = false;
    var s = document.querySelector('.slide.active'), pg = s && s.querySelector('.page');
    if (!pg) return;
    if (!proj) { pg.style.fontSize = ''; return; }
    /* Never smaller than can be read from the back of the room: a crowded chart scrolls instead. */
    var lo = Math.max(16, Math.min(innerHeight * 0.024, innerWidth * 0.018)), hi = Math.max(lo, Math.min(innerHeight * 0.05, innerWidth * 0.03));
    function fits(px) { pg.style.fontSize = px + 'px'; return s.scrollHeight <= s.clientHeight + 1 && s.scrollWidth <= s.clientWidth + 1; }
    if (fits(hi)) return;
    for (var i = 0; i < 9; i++) { var m = (lo + hi) / 2; if (fits(m)) lo = m; else hi = m; }
    fits(lo);
  }
  function fit() { if (!fitQueued) { fitQueued = true; requestAnimationFrame(fitNow); } }
  function setProj(on) {
    proj = on;
    document.documentElement.classList.toggle('proj', on);
    try { localStorage.setItem(PKEY, on ? '1' : '0'); } catch (e) {}
    document.querySelectorAll('.slide .page').forEach(function (p) { p.style.fontSize = ''; });
    var b = document.querySelector('.xproj');
    if (b) { b.textContent = on ? 'Projector ✓' : 'Projector'; b.setAttribute('aria-pressed', String(on)); }
    fit();
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
      pb.title = 'Projector: dark words on a light page, as large as the screen allows (key P)';
      pb.addEventListener('click', function () { setProj(!proj); pb.blur(); });
      bar.appendChild(pb);
      setProj(proj);
      addEventListener('resize', function () { document.querySelectorAll('.slide .page').forEach(function (p) { p.style.fontSize = ''; }); fit(); });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
      addEventListener('load', fit);
      document.addEventListener('keydown', function (e) {
        if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
        if (e.key === 'p' || e.key === 'P') { setProj(!proj); }
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
