/* Shared by every lesson page: remembers where you stopped, and adds a Share button that copies a link.
   Loaded in the page <head> so the saved slide is in the address before the page reads it. */
(function () {
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
      '.xshare{position:fixed;top:10px;left:10px;padding:8px 10px;cursor:pointer}' +
      '.xshare:hover{color:#fff}' +
      '.xtoast{position:fixed;left:50%;bottom:76px;transform:translateX(-50%);padding:10px 14px;max-width:92vw;text-transform:none;letter-spacing:0;font-size:14px;line-height:1.35}' +
      '.xtoast button{margin-left:10px;background:none;border:0;border-bottom:1px solid currentColor;color:inherit;font:inherit;cursor:pointer;padding:0}' +
      '@media print{.xshare,.xtoast{display:none}}';
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
    document.body.appendChild(b);

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
