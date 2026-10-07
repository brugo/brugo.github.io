/* Humberto Ferrante · portfolio motion layer
   GSAP + ScrollTrigger drive every scroll scene; Lenis smooths the wheel. */
(() => {
  'use strict';

  const html = document.documentElement;
  const reduced = html.classList.contains('reduced');
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const finePointer = matchMedia('(pointer: fine)').matches;

  // Motion toggle: the OS preference is the default, the visitor can override it.
  const toggle = document.querySelector('.motion-toggle');
  const setMotion = on => {
    try { localStorage.setItem('motion', on ? 'on' : 'off'); } catch (e) { /* storage may be blocked */ }
    window.scrollTo(0, 0);
    location.reload();
  };
  if (toggle) {
    toggle.setAttribute('aria-pressed', String(!reduced));
    toggle.querySelector('.mt-label').textContent = reduced ? 'Motion off' : 'Motion on';
    toggle.setAttribute('aria-label', reduced ? 'Turn animations on' : 'Turn animations off');
    toggle.addEventListener('click', () => setMotion(reduced));
  }
  const note = document.querySelector('.motion-note');
  if (note && html.classList.contains('os-reduced')) {
    note.hidden = false;
    note.querySelector('.mn-on').addEventListener('click', () => setMotion(true));
    note.querySelector('.mn-close').addEventListener('click', () => {
      try { localStorage.setItem('motion', 'off'); } catch (e) { /* ignore */ }
      note.hidden = true;
    });
  }

  if (!window.gsap || !window.ScrollTrigger) {
    html.classList.add('reduced');
    document.querySelector('.loader')?.remove();
    return;
  }
  window.__motionReady = true;

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  /* ------------------------------------------------------------------ */
  /* Split headings into characters, keeping <em>/<br> and a readable copy */
  /* ------------------------------------------------------------------ */
  function splitText(el) {
    const original = el.textContent.replace(/\s+/g, ' ').trim();
    const walk = node => {
      [...node.childNodes].forEach(child => {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(' '); return; }
            const word = document.createElement('span');
            word.className = 'w';
            word.setAttribute('aria-hidden', 'true');
            for (const ch of part) {
              const c = document.createElement('span');
              c.className = 'c';
              c.textContent = ch;
              word.append(c);
            }
            frag.append(word);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
          walk(child);
        }
      });
    };
    walk(el);
    const copy = document.createElement('span');
    copy.className = 'visually-hidden';
    copy.textContent = original;
    el.append(copy);
  }
  $$('[data-split]').forEach(splitText);

  // The two hero words always span the same width, edge to edge.
  function fitHero() {
    const words = $$('.hero-word');
    words.forEach(w => { w.style.fontSize = ''; });
    const target = innerWidth * (innerWidth < 700 ? 0.94 : 0.9);
    words.forEach(w => {
      const base = parseFloat(getComputedStyle(w).fontSize);
      const width = w.scrollWidth;
      if (width) w.style.fontSize = `${Math.min(base * target / width, 300)}px`;
    });
  }
  fitHero();
  document.fonts?.ready.then(fitHero);
  addEventListener('resize', () => { clearTimeout(fitHero.t); fitHero.t = setTimeout(fitHero, 120); });

  /* ------------------------------------------------------------------ */
  /* Smooth scroll                                                       */
  /* ------------------------------------------------------------------ */
  let lenis = null;
  if (!reduced && window.Lenis) {
    lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(time => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  window.__lenis = lenis;
  // Pin spacers change the page height after Lenis measures it; keep its scroll limit in sync.
  ScrollTrigger.addEventListener('refresh', () => lenis?.resize());

  $$('a[href^="#"]').forEach(link => {
    link.addEventListener('click', event => {
      const id = link.getAttribute('href');
      const target = id === '#top' ? 0 : $(id);
      if (target === null) return;
      event.preventDefault();
      if (lenis) lenis.scrollTo(target, { duration: 1.8, easing: t => 1 - Math.pow(1 - t, 4) });
      else if (target === 0) window.scrollTo({ top: 0 });
      else target.scrollIntoView();
      if (id === '#top') setTimeout(() => $('#dumpling')?.focus({ preventScroll: true }), 1900);
    });
  });

  /* ------------------------------------------------------------------ */
  /* Loader + intro                                                      */
  /* ------------------------------------------------------------------ */
  const loader = $('.loader');
  const loaderNum = $('.loader-num');
  const loaderBar = $('.loader-bar span');
  const counter = { v: 0 };
  const paintCounter = () => {
    loaderNum.textContent = Math.round(counter.v);
    loaderBar.style.transform = `scaleX(${counter.v / 100})`;
  };

  function heroIntro() {
    const chars = $$('.hero-word .c');
    gsap.set(chars, { y: 0, yPercent: 110 });
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.to(chars, { yPercent: 0, duration: 1.5, stagger: 0.035 }, 0)
      .add(() => $$('.hero-word').forEach(w => w.classList.add('is-in')), 1.6)
      .fromTo('.hero-pop', { scale: 0.5, opacity: 0, yPercent: 10 }, { scale: 1, opacity: 1, yPercent: 0, duration: 1.9, ease: 'elastic.out(1, 0.5)' }, 0.25)
      .fromTo('.hero-meta > *, .hero-hint, .scroll-cue, .nav, .chapter-tag', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.06 }, 0.6)
      .add(() => window.dispatchEvent(new CustomEvent('hero:intro')), 0.9);
    return tl;
  }

  function finishLoading() {
    gsap.to(counter, {
      v: 100, duration: 0.35, ease: 'power2.out', onUpdate: paintCounter,
      onComplete: () => {
        gsap.timeline()
          .to('.loader-inner', { yPercent: -40, opacity: 0, duration: 0.6, ease: 'power3.in' })
          .to(loader, { clipPath: 'inset(0 0 100% 0)', duration: 0.9, ease: 'expo.inOut' }, '-=0.15')
          .add(() => { loader.remove(); lenis?.start(); }, '-=0.1')
          .add(heroIntro(), '-=0.75');
      },
    });
  }

  if (reduced || !loader) {
    loader?.remove();
    $$('.hero-word').forEach(w => w.classList.add('is-in'));
  } else {
    loader.style.clipPath = 'inset(0 0 0% 0)';
    gsap.to(counter, { v: 86, duration: 1.1, ease: 'power2.out', onUpdate: paintCounter });
    const poster = $('.hero-poster');
    const ready = Promise.all([
      document.fonts ? document.fonts.ready : Promise.resolve(),
      poster && !poster.complete ? new Promise(r => { poster.onload = poster.onerror = r; }) : Promise.resolve(),
      new Promise(r => setTimeout(r, 1000)),
    ]);
    Promise.race([ready, new Promise(r => setTimeout(r, 3200))]).then(finishLoading);
  }

  /* ------------------------------------------------------------------ */
  /* Theme morph + chapter tag + progress                                */
  /* ------------------------------------------------------------------ */
  const THEMES = {
    ink: { bg: '#0b0a0e', fg: '#f3eee6', accent: '#ff9ec4' },
    aeh: { bg: '#0d0907', fg: '#f1e6d2', accent: '#e0a94a' },
    bis: { bg: '#f4ecdb', fg: '#1e2a23', accent: '#2f7d6b' },
    mimo: { bg: '#e4efe7', fg: '#1c2a25', accent: '#e0705c' },
    dmp: { bg: '#f6e5ec', fg: '#2a1a23', accent: '#c4588a' },
    dsp: { bg: '#060918', fg: '#e6ebff', accent: '#8b96ff' },
  };
  const themeMeta = $('meta[name="theme-color"]');
  let currentTheme = 'ink';
  Object.entries(THEMES.ink).forEach(([k, v]) => html.style.setProperty(`--${k}`, v));

  function setTheme(name) {
    if (name === currentTheme || !THEMES[name]) return;
    currentTheme = name;
    const t = THEMES[name];
    gsap.to(html, { '--bg': t.bg, '--fg': t.fg, '--accent': t.accent, duration: reduced ? 0 : 0.9, ease: 'power2.inOut', overwrite: 'auto' });
    themeMeta?.setAttribute('content', t.bg);
  }

  const tagNum = $('.ct-num');
  const tagName = $('.ct-name');
  let currentChapter = '';
  function setChapter(section) {
    const key = section.dataset.chapter + section.dataset.name;
    if (key === currentChapter) return;
    currentChapter = key;
    gsap.timeline()
      .to([tagNum, tagName], { yPercent: -60, opacity: 0, duration: 0.2, ease: 'power2.in' })
      .add(() => { tagNum.textContent = section.dataset.chapter; tagName.textContent = section.dataset.name; })
      .fromTo([tagNum, tagName], { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.45, ease: 'power3.out', stagger: 0.04 });
  }

  const progressBar = $('.progress span');
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: self => { progressBar.style.transform = `scaleX(${self.progress})`; },
  });

  /* ------------------------------------------------------------------ */
  /* Generic reveals                                                     */
  /* ------------------------------------------------------------------ */
  function revealHeadings() {
    $$('[data-split]').forEach(el => {
      if (el.closest('.hero')) return;
      const chars = $$('.c', el);
      if (reduced) { el.classList.add('is-in'); return; }
      gsap.set(chars, { y: 0, yPercent: 110 });
      ScrollTrigger.create({
        trigger: el, start: 'top 88%', once: true,
        onEnter: () => gsap.to(chars, {
          yPercent: 0, duration: 1.25, ease: 'expo.out', stagger: Math.min(0.03, 0.9 / chars.length),
          onComplete: () => el.classList.add('is-in'),
        }),
      });
    });
    $$('[data-reveal]').forEach(el => {
      if (reduced) return;
      gsap.to(el, {
        opacity: 1, y: 0, duration: 1.2, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      });
    });
    $$('[data-count]').forEach(el => {
      const target = Number(el.dataset.count);
      if (reduced) return;
      const o = { v: 0 };
      el.textContent = '0';
      ScrollTrigger.create({
        trigger: el, start: 'top 92%', once: true,
        onEnter: () => gsap.to(o, {
          v: target, duration: target > 100 ? 2 : 1.4, ease: 'power3.out',
          onUpdate: () => { el.textContent = Math.round(o.v).toLocaleString('en-US'); },
        }),
      });
    });
    $$('[data-parallax]').forEach(el => {
      if (reduced) return;
      const f = Number(el.dataset.parallax);
      gsap.fromTo(el, { yPercent: -f * 50 }, {
        yPercent: f * 50, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Lazy, autoplaying, silent videos                                    */
  /* ------------------------------------------------------------------ */
  const videos = $$('video.lazy-video');
  if (reduced) {
    videos.forEach(v => { v.src = v.dataset.src; v.controls = true; v.removeAttribute('loop'); });
  } else if ('IntersectionObserver' in window) {
    const loadIO = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const v = e.target;
        if (!v.src) { v.src = v.dataset.src; v.load(); }
        loadIO.unobserve(v);
      });
    }, { rootMargin: '900px 0px' });
    const playIO = new IntersectionObserver(entries => {
      entries.forEach(e => {
        const v = e.target;
        if (e.isIntersecting) { if (!v.src) v.src = v.dataset.src; v.play().catch(() => {}); }
        else v.pause();
      });
    }, { threshold: 0.15 });
    videos.forEach(v => { loadIO.observe(v); playIO.observe(v); });
  } else {
    videos.forEach(v => { v.src = v.dataset.src; v.autoplay = true; });
  }

  /* ------------------------------------------------------------------ */
  /* Scenes                                                              */
  /* ------------------------------------------------------------------ */
  const mm = gsap.matchMedia();

  function heroScene() {
    gsap.timeline({
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    })
      .to('.hl-1', { xPercent: -22, ease: 'none' }, 0)
      .to('.hl-2', { xPercent: 22, ease: 'none' }, 0)
      .to('.hero-stage', { yPercent: 18, scale: 0.72, ease: 'none' }, 0)
      .to('.hero-ui', { opacity: 0, y: -50, ease: 'none' }, 0)
      .to('.hero-glow', { opacity: 0.2, ease: 'none' }, 0);
  }

  function reelScene() {
    const reel = $('.reel');
    const stage = $('.reel-stage', reel);
    const items = $$('.reel-item, .reel-word', reel).map(el => ({
      el,
      x: Number(el.dataset.x || 0),
      y: Number(el.dataset.y || 0),
      z: Number(el.dataset.z),
      word: el.classList.contains('reel-word'),
      shown: null,
    }));
    const finalEl = $('.reel-final', reel);
    const finalChars = $$('.c', finalEl);
    const tc = $('.tc', reel);
    const DEPTH = 10400;
    let p = 0;
    let mx = 0, my = 0, smx = 0, smy = 0;
    let finalShown = false;

    function render() {
      const W = innerWidth, H = innerHeight;
      const narrow = W < 700;
      const cam = p * DEPTH;
      for (const it of items) {
        const z = it.z + cam;
        let o;
        if (z < -3800) o = 0;
        else if (z < -2300) o = (z + 3800) / 1500;
        else if (z < -60) o = 1;
        else o = 1 - (z + 60) / (it.word ? 420 : 520);
        o = clamp(o, 0, 1);
        const visible = o > 0.002;
        if (visible !== it.shown) { it.el.style.visibility = visible ? 'visible' : 'hidden'; it.shown = visible; }
        if (!visible) continue;
        const spread = narrow ? 0.62 : 1;
        const x = it.x * W * spread + smx * (z + 3000) * -0.012;
        const y = it.y * H * (narrow ? 1.1 : 1) + smy * (z + 3000) * -0.01;
        it.el.style.opacity = o.toFixed(3);
        it.el.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px)`;
      }
      const fp = clamp((p - 0.84) / 0.12, 0, 1);
      finalEl.style.opacity = fp.toFixed(3);
      finalEl.style.transform = `translateZ(0) scale(${(0.92 + fp * 0.08).toFixed(4)})`;
      if (fp > 0.35 && !finalShown) {
        finalShown = true;
        gsap.fromTo(finalChars, { y: 0, yPercent: 110 }, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.012 });
      }
      const frames = Math.floor(p * 24 * 42);
      const ff = String(frames % 24).padStart(2, '0');
      const ss = String(Math.floor(frames / 24) % 60).padStart(2, '0');
      tc.textContent = `00:00:${ss}:${ff}`;
    }

    gsap.set(finalChars, { y: 0, yPercent: 110 });
    ScrollTrigger.create({
      trigger: reel, start: 'top top', end: '+=520%', pin: true, scrub: true,
      onUpdate: self => { p = self.progress; render(); },
      onRefresh: self => { p = self.progress; render(); },
    });

    if (finePointer) {
      addEventListener('pointermove', e => {
        mx = e.clientX / innerWidth - 0.5;
        my = e.clientY / innerHeight - 0.5;
      }, { passive: true });
      gsap.ticker.add(() => {
        const nx = smx + (mx - smx) * 0.06, ny = smy + (my - smy) * 0.06;
        if (Math.abs(nx - smx) + Math.abs(ny - smy) < 0.0004) return;
        smx = nx; smy = ny;
        const r = stage.getBoundingClientRect();
        if (r.bottom > 0 && r.top < innerHeight) render();
      });
    }
    render();
  }

  function aehScenes() {
    gsap.fromTo('.aeh-intro .ch-intro-bg img', { scale: 1.32, yPercent: -4 }, {
      scale: 1.04, yPercent: 6, ease: 'none',
      scrollTrigger: { trigger: '.aeh-intro', start: 'top bottom', end: 'bottom top', scrub: true },
    });

    // The ring of hero cards.
    const ring = $('.ring');
    const cards = $$('.ring-card', ring);
    const N = cards.length;
    const step = 360 / N;
    let R = 600;
    let current = -1;
    const info = { role: $('.ri-role'), name: $('.ri-name'), res: $('.ri-res b') };

    function layout() {
      const cw = cards[0].offsetWidth;
      R = Math.round((cw / 2) / Math.tan(Math.PI / N) * 1.16);
      cards.forEach((card, i) => { card.style.transform = `rotateY(${i * step}deg) translateZ(${R}px)`; });
    }
    function showInfo(i) {
      current = i;
      const d = cards[i].dataset;
      gsap.timeline()
        .to(['.ri-role', '.ri-name', '.ri-res'], { opacity: 0, y: -8, duration: 0.15, ease: 'power2.in' })
        .add(() => { info.role.textContent = d.role; info.name.textContent = d.name; info.res.textContent = d.res; })
        .to(['.ri-role', '.ri-name', '.ri-res'], { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out', stagger: 0.04 });
    }
    function render(angle) {
      ring.style.transform = `translateZ(${-R}px) rotateX(-7deg) rotateY(${angle.toFixed(2)}deg)`;
      cards.forEach((card, i) => {
        let a = ((i * step + angle) % 360 + 360) % 360;
        if (a > 180) a -= 360;
        card.style.setProperty('--dim', (Math.min(Math.abs(a) / 150, 1) * 0.82).toFixed(3));
      });
      const front = ((Math.round(-angle / step) % N) + N) % N;
      if (front !== current) showInfo(front);
    }
    layout();
    render(0);
    ScrollTrigger.create({
      trigger: '.ring-section', start: 'top top', end: '+=300%', pin: true, scrub: 0.6,
      onUpdate: self => render(-self.progress * (360 - step)),
      onRefresh: self => { layout(); render(-self.progress * (360 - step)); },
    });

    // Gameplay screen tilts up to face you.
    gsap.fromTo('.screen-tilt', { rotateX: 38, scale: 0.84, y: 40 }, {
      rotateX: 0, scale: 1, y: 0, ease: 'none',
      scrollTrigger: { trigger: '.screen-wrap', start: 'top 98%', end: 'top 22%', scrub: true },
    });
    gsap.fromTo('.screen-glare', { xPercent: -70 }, {
      xPercent: 90, ease: 'none',
      scrollTrigger: { trigger: '.screen-wrap', start: 'top bottom', end: 'bottom top', scrub: true },
    });
    if (innerWidth >= 900) {
      gsap.from('.callout', {
        opacity: 0, y: 24, scale: 0.94, duration: 0.9, ease: 'back.out(1.6)', stagger: 0.18,
        scrollTrigger: { trigger: '.screen-wrap', start: 'top 30%', once: true },
      });
    }
  }

  function bistroScenes() {
    // On wide screens the clip opens to full bleed; on tall phones it opens to a 16:10 band.
    const narrow = () => innerWidth < 900;
    const band = scale => Math.max(0, Math.round((innerHeight - innerWidth * 0.625 * scale) / 2));
    const clipFrom = () => (narrow() ? `inset(${band(0.78)}px 11% round 20px)` : 'inset(18% 22% round 28px)');
    const clipTo = () => (narrow() ? `inset(${band(1)}px 0% round 0px)` : 'inset(0% 0% round 0px)');
    gsap.timeline({
      scrollTrigger: { trigger: '.expand-section', start: 'top top', end: '+=170%', pin: true, scrub: true, invalidateOnRefresh: true },
    })
      .fromTo('.expand-media', { clipPath: clipFrom }, { clipPath: clipTo, ease: 'none', duration: 1 }, 0)
      .fromTo('.expand-media video', { scale: 1.3 }, { scale: 1, ease: 'none', duration: 1 }, 0)
      .fromTo('.expand-caption', { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }, 0.75);

    mm.add('(min-width: 900px)', () => {
      const track = $('.hg-track');
      const distance = () => Math.max(0, track.scrollWidth - innerWidth);
      const tween = gsap.to(track, {
        x: () => -distance(), ease: 'none',
        scrollTrigger: {
          trigger: '.hgallery', start: 'top top', end: () => `+=${distance()}`,
          pin: true, scrub: 0.8, invalidateOnRefresh: true,
        },
      });
      $$('.hg-panel').forEach(panel => {
        gsap.fromTo($('img', panel), { xPercent: -3.5 }, {
          xPercent: 3.5, ease: 'none',
          scrollTrigger: { trigger: panel, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true },
        });
      });
      const skew = gsap.quickTo(track, 'skewX', { duration: 0.6, ease: 'power3' });
      let settle;
      ScrollTrigger.create({
        trigger: '.hgallery', start: 'top top', end: () => `+=${distance()}`,
        onUpdate: self => {
          skew(clamp(self.getVelocity() / -320, -5, 5));
          clearTimeout(settle);
          settle = setTimeout(() => skew(0), 140);
        },
      });
      return () => gsap.set(track, { x: 0, skewX: 0 });
    });
  }

  function mimoScenes() {
    const frames = $$('.story-frames img');
    const steps = $$('.story-steps li');
    const bar = $('.story-progress span');
    const F = frames.length;
    let active = 0;
    function render(p) {
      const f = p * (F - 1);
      frames.forEach((img, i) => {
        const o = i <= f ? 1 : clamp(1 - (i - f), 0, 1);
        img.style.opacity = o.toFixed(3);
        img.style.transform = `scale(${(1.06 - 0.06 * clamp(f - i + 1, 0, 1)).toFixed(4)})`;
      });
      const step = Number(frames[Math.min(F - 1, Math.round(f))].dataset.step);
      if (step !== active) {
        active = step;
        steps.forEach((li, i) => li.classList.toggle('is-active', i === step));
      }
      bar.style.transform = `scaleX(${p.toFixed(4)})`;
    }
    render(0);
    ScrollTrigger.create({
      trigger: '.story', start: 'top top', end: `+=${F * 45}%`, pin: true, scrub: 0.5,
      onUpdate: self => render(self.progress),
    });

    gsap.from('.sq', {
      y: 80, rotate: (i) => (i % 2 ? 6 : -6), opacity: 0, duration: 1.3, ease: 'expo.out', stagger: 0.1,
      scrollTrigger: { trigger: '.squish-grid', start: 'top 80%', once: true },
    });
    gsap.fromTo('.mp-media', { scale: 0.86, rotate: -2 }, {
      scale: 1, rotate: 0, ease: 'none',
      scrollTrigger: { trigger: '.mimo-play', start: 'top bottom', end: 'center center', scrub: true },
    });
  }

  function dumplingScenes() {
    gsap.fromTo('.dmp-orb', { scale: 0.62, rotate: -12 }, {
      scale: 1, rotate: 0, ease: 'none',
      scrollTrigger: { trigger: '.dmp', start: 'top bottom', end: 'center center', scrub: true },
    });
  }

  function despertaversoScene() {
    const canvas = $('.dsp-stars');
    const ctx = canvas.getContext('2d');
    const stars = Array.from({ length: 420 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() }));
    let w = 0, h = 0, dpr = 1, running = false, speed = 0.0018;
    function resize() {
      dpr = Math.min(devicePixelRatio || 1, 1.5);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function frame() {
      if (!running) return;
      const vel = lenis ? Math.abs(lenis.velocity) : 0;
      speed += ((0.0016 + Math.min(vel, 60) * 0.00045) - speed) * 0.08;
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h * 0.42, scale = Math.max(w, h) * 0.6;
      for (const s of stars) {
        const pz = s.z;
        s.z -= speed;
        if (s.z <= 0.02) { s.x = Math.random() * 2 - 1; s.y = Math.random() * 2 - 1; s.z = 1; continue; }
        const sx = cx + (s.x / s.z) * scale * 0.5, sy = cy + (s.y / s.z) * scale * 0.5;
        const px = cx + (s.x / pz) * scale * 0.5, py = cy + (s.y / pz) * scale * 0.5;
        const a = clamp(1 - s.z, 0, 1);
        ctx.strokeStyle = s.x > 0.6 ? `rgba(94,240,255,${a})` : `rgba(200,206,255,${a * 0.9})`;
        ctx.lineWidth = Math.max(0.6, (1 - s.z) * 2.2);
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(sx, sy); ctx.stroke();
      }
      requestAnimationFrame(frame);
    }
    resize();
    addEventListener('resize', resize);
    if (reduced) { running = true; frame(); running = false; return; }
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !running) { running = true; requestAnimationFrame(frame); }
      else if (!e.isIntersecting) running = false;
    }).observe(canvas);
    gsap.from('.dsp-city', {
      opacity: 0, scale: 0, transformOrigin: 'center', duration: 0.9, ease: 'back.out(2)', stagger: 0.25,
      scrollTrigger: { trigger: '.dsp-map', start: 'top 75%', once: true },
    });
  }

  function processScenes() {
    const track = $('.ticker-track');
    const loop = gsap.to(track, { xPercent: -50, duration: 38, ease: 'none', repeat: -1 });
    ScrollTrigger.create({
      trigger: '.ticker', start: 'top bottom', end: 'bottom top',
      onUpdate: self => {
        const v = clamp(Math.abs(self.getVelocity()) / 400, 0, 6);
        gsap.to(loop, { timeScale: 1 + v, duration: 0.3, overwrite: true });
        gsap.to(loop, { timeScale: 1, duration: 1.2, delay: 0.3 });
      },
    });
  }

  /* ------------------------------------------------------------------ */
  /* Pointer toys: cursor, magnetic links, tilt                          */
  /* ------------------------------------------------------------------ */
  function pointerToys() {
    if (!finePointer || reduced) return;
    document.body.classList.add('has-cursor');
    const cursor = $('.cursor');
    const ringEl = $('.cursor-ring');
    const dot = $('.cursor-dot');
    const label = $('.cursor-label');
    const rx = gsap.quickTo(ringEl, 'x', { duration: 0.5, ease: 'power3' });
    const ry = gsap.quickTo(ringEl, 'y', { duration: 0.5, ease: 'power3' });
    const dx = gsap.quickTo(dot, 'x', { duration: 0.08 });
    const dy = gsap.quickTo(dot, 'y', { duration: 0.08 });
    addEventListener('pointermove', e => { rx(e.clientX); ry(e.clientY); dx(e.clientX); dy(e.clientY); }, { passive: true });
    addEventListener('pointerdown', () => cursor.classList.add('is-down'));
    addEventListener('pointerup', () => cursor.classList.remove('is-down'));
    document.addEventListener('pointerover', e => {
      const target = e.target.closest('[data-cursor], a, button, #dumpling');
      cursor.classList.remove('is-hover', 'is-label');
      if (!target) return;
      const text = target.id === 'dumpling' ? 'Squish' : target.dataset.cursor;
      if (text) { label.textContent = text; cursor.classList.add('is-label'); }
      else cursor.classList.add('is-hover');
    });
    document.addEventListener('pointerleave', () => gsap.to(cursor, { opacity: 0, duration: 0.2 }));
    document.addEventListener('pointerenter', () => gsap.to(cursor, { opacity: 1, duration: 0.2 }));

    $$('[data-magnetic]').forEach(el => {
      const xTo = gsap.quickTo(el, 'x', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.32);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.32);
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });

    $$('[data-tilt]').forEach(el => {
      const rxTo = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3' });
      const ryTo = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3' });
      gsap.set(el, { transformPerspective: 900 });
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        rxTo(((e.clientY - r.top) / r.height - 0.5) * -14);
        ryTo(((e.clientX - r.left) / r.width - 0.5) * 14);
      });
      el.addEventListener('pointerleave', () => { rxTo(0); ryTo(0); });
    });

    $$('.screen').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        gsap.to(el, { rotationY: ((e.clientX - r.left) / r.width - 0.5) * 6, rotationX: ((e.clientY - r.top) / r.height - 0.5) * -5, duration: 0.8, ease: 'power3', overwrite: 'auto' });
      });
      el.addEventListener('pointerleave', () => gsap.to(el, { rotationY: 0, rotationX: 0, duration: 1, ease: 'power3' }));
    });
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */
  if (!reduced) {
    heroScene();
    reelScene();
    aehScenes();
    bistroScenes();
    mimoScenes();
    dumplingScenes();
    processScenes();
  }
  despertaversoScene();
  revealHeadings();
  pointerToys();

  // Theme + chapter triggers go last so they measure the final, pinned layout.
  $$('section[data-theme]').forEach(section => {
    const spacer = section.parentElement.classList.contains('pin-spacer') ? section.parentElement : section;
    ScrollTrigger.create({
      trigger: spacer, start: 'top 55%', end: 'bottom 55%',
      onToggle: self => { if (self.isActive) { setTheme(section.dataset.theme); setChapter(section); } },
    });
  });

  addEventListener('load', () => ScrollTrigger.refresh());
  // Late images or fonts can still nudge the layout: re-measure once things settle.
  let refreshTimer;
  const queueRefresh = () => { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 250); };
  $$('img[loading="lazy"]').forEach(img => { if (!img.complete) img.addEventListener('load', queueRefresh, { once: true }); });
  new ResizeObserver(queueRefresh).observe(document.querySelector('main'));
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
})();
