// Leerpunt motion guide — video-bediening, tijdlijnen en actieve hoofdstukken in de zijbalk.
(() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = (s) => s.toFixed(s < 10 && s % 1 ? 1 : 0).replace('.', ',') + ' s';

  /* ---------- Video's: spelen zodra ze in beeld komen ---------- */
  const videos = [...document.querySelectorAll('video[data-auto]')];
  const visible = new Set();
  let focused = null; // de video onder de muis; de andere staan dan stil
  let resumeTimer;
  const start = (v) => { if (!v.dataset.userPaused && !reduceMotion) v.play().catch(() => {}); };
  const resumeVisible = () => { focused = null; visible.forEach(start); };

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = e.target;
      if (e.isIntersecting) {
        visible.add(v);
        if (!focused || focused === v) start(v);
      } else {
        visible.delete(v);
        v.pause();
        if (v === focused) resumeVisible();
      }
    }
  }, { threshold: 0.35 });
  videos.forEach((v) => { v.muted = true; io.observe(v); });

  /* ---------- Muis op een video: de andere video's pauzeren ---------- */
  videos.forEach((v) => {
    const zone = v.closest('.clip, .hero-video') || v;
    zone.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      clearTimeout(resumeTimer);
      focused = v;
      videos.forEach((o) => { if (o !== v) o.pause(); });
      start(v);
    });
    zone.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'mouse' || focused !== v) return;
      // korte wachttijd, zodat niets opstart als de muis meteen naar de volgende video gaat
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(resumeVisible, 150);
    });
  });

  const icon = {
    play: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5v9l7.5-4.5z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" fill="currentColor"/></svg>',
    restart: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2a4 4 0 1 1-4 4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 .2v3.6L3.6 2z" fill="currentColor"/></svg>',
  };

  document.querySelectorAll('.clip').forEach((clip) => {
    const v = clip.querySelector('video');
    const bar = clip.querySelector('.controls');
    if (!v || !bar) return;
    const btn = (label, html, extra = '') => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'pill outline ' + extra; b.innerHTML = html; b.setAttribute('aria-label', label); b.title = label;
      bar.appendChild(b); return b;
    };
    const play = btn('Afspelen of pauzeren', icon.play);
    const sync = () => { play.innerHTML = v.paused ? icon.play : icon.pause; };
    v.addEventListener('play', sync); v.addEventListener('pause', sync); sync();
    play.addEventListener('click', () => {
      if (v.paused) { delete v.dataset.userPaused; v.play(); } else { v.dataset.userPaused = '1'; v.pause(); }
    });
    btn('Opnieuw vanaf het begin', icon.restart).addEventListener('click', () => { v.currentTime = 0; delete v.dataset.userPaused; v.play(); });
    const slow = btn('Vertraagd afspelen (0,25×)', '0,25×');
    slow.setAttribute('aria-pressed', 'false');
    slow.addEventListener('click', () => {
      const on = v.playbackRate === 1;
      v.playbackRate = on ? 0.25 : 1; slow.setAttribute('aria-pressed', String(on));
    });
    if (v.dataset.audio !== undefined) {
      const snd = btn('Geluid aan of uit', 'Geluid');
      snd.setAttribute('aria-pressed', 'false');
      snd.addEventListener('click', () => { v.muted = !v.muted; snd.setAttribute('aria-pressed', String(!v.muted)); if (!v.muted) v.play(); });
    }
  });

  /* ---------- Lightbox: video geïsoleerd bekijken, passend of op ware grootte ---------- */
  const dlg = document.createElement('dialog');
  dlg.className = 'lightbox';
  dlg.setAttribute('aria-label', 'Video vergroot');
  dlg.innerHTML = `
    <div class="lb-bar">
      <span class="lb-name"></span><span class="lb-res"></span>
      <button type="button" class="pill light lb-slow" aria-pressed="false" title="Vertraagd afspelen (0,25×)">0,25×</button>
      <button type="button" class="pill light lb-size" aria-pressed="false" title="Ware grootte: 1 videopixel = 1 schermpixel">100 %</button>
      <button type="button" class="lb-close" aria-label="Sluiten" title="Sluiten (Esc)"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
    </div>
    <div class="lb-stage"><video controls playsinline loop></video></div>`;
  document.body.appendChild(dlg);
  const lbVideo = dlg.querySelector('video');
  const lbStage = dlg.querySelector('.lb-stage');
  const lbSize = dlg.querySelector('.lb-size');
  const lbSlow = dlg.querySelector('.lb-slow');
  let lbSource = null;

  const setNative = (on) => {
    dlg.classList.toggle('native', on);
    lbSize.setAttribute('aria-pressed', String(on));
    if (on && lbVideo.videoWidth) {
      // 1 videopixel = 1 fysieke schermpixel
      lbVideo.style.width = lbVideo.videoWidth / devicePixelRatio + 'px';
      lbVideo.style.height = lbVideo.videoHeight / devicePixelRatio + 'px';
    } else {
      lbVideo.style.width = lbVideo.style.height = '';
    }
  };
  const openLightbox = (src) => {
    lbSource = src;
    src.pause();
    lbVideo.src = src.currentSrc || src.src;
    lbVideo.poster = src.poster;
    lbVideo.muted = src.dataset.audio === undefined ? true : src.muted;
    lbVideo.playbackRate = 1; lbSlow.setAttribute('aria-pressed', 'false');
    dlg.querySelector('.lb-name').textContent = src.closest('.clip')?.querySelector('.name')?.textContent || 'logo-solo';
    setNative(false);
    lbVideo.addEventListener('loadedmetadata', () => {
      dlg.querySelector('.lb-res').textContent = `${lbVideo.videoWidth} × ${lbVideo.videoHeight}`;
      lbVideo.currentTime = src.currentTime;
      lbVideo.play().catch(() => {});
    }, { once: true });
    document.documentElement.classList.add('lb-open');
    dlg.showModal();
  };
  const closeLightbox = () => { if (dlg.open) dlg.close(); };
  dlg.addEventListener('close', () => {
    document.documentElement.classList.remove('lb-open');
    lbVideo.pause();
    if (lbSource) { lbSource.currentTime = lbVideo.currentTime; delete lbSource.dataset.userPaused; lbSource.play().catch(() => {}); }
    lbVideo.removeAttribute('src'); lbVideo.load();
  });
  dlg.querySelector('.lb-close').addEventListener('click', closeLightbox);
  lbSize.addEventListener('click', () => setNative(!dlg.classList.contains('native')));
  lbSlow.addEventListener('click', () => {
    const on = lbVideo.playbackRate === 1;
    lbVideo.playbackRate = on ? 0.25 : 1; lbSlow.setAttribute('aria-pressed', String(on));
  });
  // klik naast de video (op de achtergrond) sluit
  lbStage.addEventListener('click', (e) => { if (e.target === lbStage) closeLightbox(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) closeLightbox(); });

  const expandIcon = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1.5 4.5v-3h3M10.5 4.5v-3h-3M1.5 7.5v3h3M10.5 7.5v3h-3" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
  document.querySelectorAll('.clip video, .hero-video video').forEach((v) => {
    const frame = v.closest('.media-frame, .hero-video');
    frame.classList.add('zoomable');
    frame.addEventListener('click', () => openLightbox(v));
    const bar = v.closest('.clip')?.querySelector('.controls');
    if (bar) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'pill outline'; b.innerHTML = expandIcon;
      b.setAttribute('aria-label', 'Vergroot bekijken'); b.title = 'Vergroot bekijken';
      b.addEventListener('click', () => openLightbox(v));
      bar.appendChild(b);
    }
  });

  /* ---------- Tijdlijnen ----------
     data-phases: [[start, end, "label", "kleur", laag], …] in seconden; data-lanes: ["Punt", "Vorm", …].
     Zonder data-lanes staat alles op één laag. Na de laatste fase volgt automatisch de rust. */
  document.querySelectorAll('.timeline[data-phases]').forEach((tl) => {
    const dur = parseFloat(tl.dataset.dur);
    const phases = JSON.parse(tl.dataset.phases);
    const lanes = tl.dataset.lanes ? JSON.parse(tl.dataset.lanes) : [''];
    const end = Math.max(...phases.map((p) => p[1]));
    const pct = (s) => (s / dur) * 100 + '%';

    const grid = document.createElement('div');
    grid.className = 'tl-grid' + (lanes.length > 1 ? ' has-lanes' : '');
    const labels = document.createElement('div'); labels.className = 'tl-labels';
    const track = document.createElement('div'); track.className = 'track';
    track.style.setProperty('--lanes', lanes.length);
    lanes.forEach((name) => { const n = document.createElement('span'); n.textContent = name; labels.appendChild(n); });

    if (dur - end > 0.05) {
      const r = document.createElement('div'); r.className = 'rust';
      r.style.left = pct(end); r.style.width = pct(dur - end);
      r.innerHTML = '<span>rust</span>'; track.appendChild(r);
    }
    for (const [a, b, label, color, lane = 0] of phases) {
      const s = document.createElement('div'); s.className = 'seg';
      s.style.left = pct(a); s.style.width = `max(4px, calc(${pct(b - a)} - 2px))`;
      s.style.top = `calc(${lane} * (var(--lane-h) + var(--lane-gap)))`;
      s.style.background = `var(--${color || 'hemels'})`;
      if (['heroisch', 'nacht', 'ambitieus'].includes(color)) s.style.color = 'var(--wit)';
      s.textContent = label; s.title = `${label}: ${fmt(a)} – ${fmt(b)}`;
      track.appendChild(s);
    }
    const head = document.createElement('div'); head.className = 'playhead'; track.appendChild(head);
    const ticks = document.createElement('div'); ticks.className = 'ticks';
    for (let t = 0; t <= dur + 0.001; t += 1) { const sp = document.createElement('span'); sp.style.left = pct(t); sp.textContent = t + ' s'; ticks.appendChild(sp); }
    grid.append(labels, track, document.createElement('span'), ticks);
    tl.querySelector('.timeline-head').after(grid);

    const v = tl.dataset.video && document.getElementById(tl.dataset.video);
    if (!v) { head.remove(); return; }
    const loop = () => { head.style.left = pct(Math.min(v.currentTime, dur)); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    // klik op de tijdlijn = spring naar dat moment
    track.style.cursor = 'pointer';
    track.addEventListener('click', (e) => {
      const r = track.getBoundingClientRect();
      v.currentTime = ((e.clientX - r.left) / r.width) * dur;
    });
  });

  /* ---------- Actief hoofdstuk in de zijbalk ---------- */
  const links = [...document.querySelectorAll('.sidebar nav a')];
  const sections = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  const so = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) {
      links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
    }
  }, { rootMargin: '-35% 0px -60% 0px' });
  sections.forEach((s) => so.observe(s));
})();
