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
    cozy: { bg: '#efe4d2', fg: '#2a201b', accent: '#c8573a' },
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
    const DEPTH = 12200;
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
      trigger: reel, start: 'top top', end: '+=600%', pin: true, scrub: true,
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
  /* 01 · CozyValley                                                     */
  /* ------------------------------------------------------------------ */

  // Scrolling drives the Kombi 100 km through the game's five biomes.
  function driveScene() {
    const svg = $('.drive-scene');
    if (!svg) return () => {};
    const NS = 'http://www.w3.org/2000/svg';
    const make = (tag, attrs = {}, parent = svg) => {
      const n = document.createElementNS(NS, tag);
      for (const k in attrs) n.setAttribute(k, attrs[k]);
      parent.append(n);
      return n;
    };
    let seed = 7;
    const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const TILE = 2000;
    const PX_PER_KM = 170;

    // Biome palettes: sky (top, middle, horizon), sun, five layers far→near, road.
    const BIOMES = [
      { name: 'Valley', sky: ['#f19f7f', '#f7c49d', '#fbe0bc'], layers: ['#cfa3a0', '#a68e98', '#6f8579', '#4b6a56', '#2c4434'], road: '#c99469' },
      { name: 'Pine forest', sky: ['#e58566', '#f0b08a', '#f7d0a8'], layers: ['#b88c96', '#837389', '#4e635f', '#2c4a3f', '#192d26'], road: '#a97b59' },
      { name: 'Plateau', sky: ['#eca566', '#f5cc8e', '#fce6bb'], layers: ['#d8b38f', '#c69c6e', '#aa8450', '#846737', '#584527'], road: '#c99961' },
      { name: 'Autumn', sky: ['#dd6b4b', '#f0996a', '#f8c38d'], layers: ['#cb907e', '#b77259', '#9f5539', '#793b27', '#4a271b'], road: '#af7750' },
      { name: 'Highlands', sky: ['#7b82b2', '#c798a6', '#efc1a0'], layers: ['#a59fbd', '#8683a3', '#676786', '#494c67', '#2b2e44'], road: '#8e7977' },
    ];
    // km keyframes: each biome holds, then blends over ~6 km like the game's 7 km mix.
    const KEYS = [[0, 0], [13, 0], [19, 1], [33, 1], [39, 2], [55, 2], [61, 3], [77, 3], [83, 4], [100, 4]];
    const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const mixHex = (a, b, t) => {
      const A = hex(a), B = hex(b);
      return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
    };
    function weights(km) {
      for (let i = 0; i < KEYS.length - 1; i++) {
        const [k0, b0] = KEYS[i], [k1, b1] = KEYS[i + 1];
        if (km <= k1) {
          const t = k1 === k0 ? 0 : (km - k0) / (k1 - k0);
          return { a: b0, b: b1, t: b0 === b1 ? 0 : t * t * (3 - 2 * t) };
        }
      }
      return { a: 4, b: 4, t: 0 };
    }

    const defs = make('defs');
    const sky = make('linearGradient', { id: 'drive-sky', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    const skyStops = [0, 0.55, 1].map(o => make('stop', { offset: o }, sky));
    const glow = make('radialGradient', { id: 'drive-sun' }, defs);
    make('stop', { offset: 0, 'stop-color': '#fff6d6', 'stop-opacity': 0.95 }, glow);
    make('stop', { offset: 0.35, 'stop-color': '#ffd9a0', 'stop-opacity': 0.45 }, glow);
    make('stop', { offset: 1, 'stop-color': '#ffc690', 'stop-opacity': 0 }, glow);
    make('rect', { x: -1000, y: 0, width: 4000, height: 1000, fill: 'url(#drive-sky)' });

    const stars = make('g', { opacity: 0 });
    for (let i = 0; i < 90; i++) make('circle', { cx: rand() * 2000, cy: rand() * 430, r: 0.8 + rand() * 1.8, fill: '#fff8ec' }, stars);
    const sunG = make('g');
    make('circle', { cx: 0, cy: 0, r: 300, fill: 'url(#drive-sun)' }, sunG);
    const sunDisc = make('circle', { cx: 0, cy: 0, r: 66, fill: '#fff1cf' }, sunG);

    const nameG = make('g', { class: 'biome-names' });
    const names = BIOMES.map(b => make('text', { x: 1000, y: 520, 'text-anchor': 'middle', fill: '#fff8ee', opacity: 0 }, nameG));
    names.forEach((t, i) => { t.textContent = BIOMES[i].name; });

    function pine(x, y, h) {
      const w = h * 0.46;
      return `M${x - w / 2},${y}L${x},${y - h * 0.58}L${x + w / 2},${y}Z`
        + `M${x - w * 0.4},${y - h * 0.3}L${x},${y - h * 0.82}L${x + w * 0.4},${y - h * 0.3}Z`
        + `M${x - w * 0.27},${y - h * 0.56}L${x},${y - h}L${x + w * 0.27},${y - h * 0.56}Z`
        + `M${x - h * 0.03},${y}h${h * 0.06}v${h * 0.06}h${-h * 0.06}Z`;
    }
    function hillsPath(cfg) {
      const phases = cfg.k.map(() => rand() * Math.PI * 2);
      const height = x => cfg.base - cfg.k.reduce((s, k, i) => s + cfg.a[i] * (0.5 + 0.5 * Math.sin((Math.PI * 2 * k * x) / TILE + phases[i])), 0);
      let d = `M0,1000L0,${height(0).toFixed(1)}`;
      for (let x = 20; x <= TILE; x += 20) d += `L${x},${height(x).toFixed(1)}`;
      d += 'L2000,1000Z';
      for (let i = 0; i < cfg.trees; i++) {
        const x = rand() * TILE;
        const h = cfg.size[0] + rand() * (cfg.size[1] - cfg.size[0]);
        d += pine(x, height(x) + 4, h);
      }
      return d;
    }
    const LAYERS = [
      { base: 640, a: [150, 60, 22], k: [2, 5, 11], trees: 0, size: [0, 0], speed: 0.05 },
      { base: 700, a: [70, 30], k: [3, 7], trees: 50, size: [16, 30], speed: 0.14 },
      { base: 770, a: [42, 16], k: [4, 9], trees: 120, size: [26, 52], speed: 0.3 },
      { base: 852, a: [24, 10], k: [5, 12], trees: 70, size: [48, 96], speed: 0.56 },
    ];
    const layerGroups = LAYERS.map(cfg => {
      const g = make('g');
      const d = hillsPath(cfg);
      make('path', { d }, g);
      make('path', { d, transform: `translate(${TILE},0)` }, g);
      return { g, cfg };
    });

    // Road with stones, kilometre signs on the far verge, then the van.
    const road = make('g');
    const roadBand = make('rect', { x: -1000, y: 872, width: 4000, height: 70 }, road);
    const roadEdge = make('rect', { x: -1000, y: 872, width: 4000, height: 6, fill: 'rgba(40,25,15,.18)' }, road);
    const stonesG = make('g', { fill: 'rgba(60,40,25,.28)' }, road);
    let stonesD = '';
    for (let i = 0; i < 70; i++) {
      const x = rand() * TILE, y = 884 + rand() * 50, r = 2 + rand() * 5;
      stonesD += `M${x - r},${y}a${r},${r * 0.6} 0 1,0 ${2 * r},0a${r},${r * 0.6} 0 1,0 ${-2 * r},0Z`;
    }
    make('path', { d: stonesD }, stonesG);
    make('path', { d: stonesD, transform: `translate(${TILE},0)` }, stonesG);
    const signs = [];
    for (let k = 10; k <= 90; k += 10) {
      const s = make('g', { class: 'sign' }, road);
      make('rect', { x: -3, y: -64, width: 6, height: 66, fill: '#5a3e2b' }, s);
      make('rect', { x: -34, y: -92, width: 68, height: 30, rx: 4, fill: '#f8eedd', stroke: '#5a3e2b', 'stroke-width': 3 }, s);
      const t = make('text', { x: 0, y: -71, 'text-anchor': 'middle', fill: '#3a2a20' }, s);
      t.textContent = `KM ${k}`;
      signs.push({ el: s, k });
    }

    // The van stays centred in whatever slice of the 2000-wide scene the screen shows.
    let VAN_SCALE = 1.35, VAN_X = 826;
    const VAN_Y = 922;
    const fitVan = () => {
      const r = svg.getBoundingClientRect();
      VAN_SCALE = r.width && r.width / r.height < 1 ? 0.92 : 1.35;
      VAN_X = 1000 - 127 * VAN_SCALE;
    };
    fitVan();
    addEventListener('resize', fitVan);
    const van = make('g');
    make('ellipse', { cx: 125, cy: 4, rx: 140, ry: 9, fill: 'rgba(30,18,10,.25)' }, van);
    const body = make('g', {}, van);
    // roof load
    make('rect', { x: 66, y: -184, width: 62, height: 26, rx: 5, fill: '#6fa39a' }, body);
    make('rect', { x: 140, y: -176, width: 58, height: 18, rx: 9, fill: '#f4dfbf' }, body);
    make('path', { d: 'M40,-158H214M52,-158v-10M118,-158v-10M190,-158v-10', stroke: '#6b5446', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round' }, body);
    // shell: cream top, terracotta bottom
    make('path', { d: 'M8,-150Q8,-158 18,-158H222Q238,-158 241,-142L246,-96H6Z', fill: '#f5e6cc' }, body);
    make('path', { d: 'M6,-96H246L248,-58Q248,-40 232,-40H18Q6,-40 6,-52Z', fill: '#d4673f' }, body);
    make('path', { d: 'M6,-97H246', stroke: '#fbf2e2', 'stroke-width': 4 }, body);
    make('path', { d: 'M150,-94V-44', stroke: '#a94d2d', 'stroke-width': 2 }, body);
    make('rect', { x: 120, y: -78, width: 18, height: 4, rx: 2, fill: '#f5e6cc' }, body);
    // windows
    [[18, 54], [80, 54], [142, 46]].forEach(([x, w]) => make('rect', { x, y: -146, width: w, height: 38, rx: 6, fill: '#3b4252' }, body));
    make('path', { d: 'M198,-146H230Q236,-146 238,-138L242,-108H198Z', fill: '#3b4252' }, body);
    make('path', { d: 'M28,-112L48,-144M90,-112L112,-144M206,-112L224,-144', stroke: 'rgba(255,255,255,.22)', 'stroke-width': 5 }, body);
    make('circle', { cx: 238, cy: -70, r: 8, fill: '#fff4d8' }, body);
    make('rect', { x: -2, y: -46, width: 254, height: 8, rx: 4, fill: '#f5e6cc' }, body);
    const wheels = [52, 196].map(cx => {
      make('circle', { cx, cy: -28, r: 32, fill: '#a94d2d' }, van);
      const w = make('g', {}, van);
      make('circle', { cx, cy: -26, r: 26, fill: '#2b2729' }, w);
      make('circle', { cx, cy: -26, r: 13, fill: '#f0e2c8' }, w);
      [0, 90, 180, 270].forEach(a => make('circle', { cx: cx + 8 * Math.cos(a * Math.PI / 180), cy: -26 + 8 * Math.sin(a * Math.PI / 180), r: 2.2, fill: '#2b2729' }, w));
      make('circle', { cx, cy: -26, r: 3.5, fill: '#d4673f' }, w);
      return { w, cx };
    });
    const puffs = make('g', { fill: 'rgba(255,248,236,.55)' }, van);
    const puffDots = [0, 1, 2].map(() => make('circle', { cx: 0, cy: -48, r: 6 }, puffs));

    // Foreground: big dark pines that whip past faster than the road.
    const fore = { g: make('g'), cfg: { base: 1000, a: [12, 6], k: [6, 13], trees: 6, size: [170, 300], speed: 1.45 } };
    const fd = hillsPath(fore.cfg);
    make('path', { d: fd }, fore.g);
    make('path', { d: fd, transform: `translate(${TILE},0)` }, fore.g);

    const hud = $('.drive-hud');
    const hudNum = $('.hud-num');
    const hudBiome = $('.hud-biome');
    const copy = $('.drive-copy');
    const hint = $('.drive-hint');
    let shownBiome = 'Valley';

    return function render(p) {
      const km = clamp(p, 0, 1) * 100;
      const { a, b, t } = weights(km);
      const A = BIOMES[a], B = BIOMES[b];
      skyStops.forEach((s, i) => s.setAttribute('stop-color', mixHex(A.sky[i], B.sky[i], t)));
      const dist = km * PX_PER_KM;
      layerGroups.forEach(({ g, cfg }, i) => {
        g.setAttribute('fill', mixHex(A.layers[i], B.layers[i], t));
        g.setAttribute('transform', `translate(${-((dist * cfg.speed) % TILE)},0)`);
      });
      fore.g.setAttribute('fill', mixHex(A.layers[4], B.layers[4], t));
      fore.g.setAttribute('transform', `translate(${-((dist * fore.cfg.speed) % TILE)},0)`);
      roadBand.setAttribute('fill', mixHex(A.road, B.road, t));
      stonesG.setAttribute('transform', `translate(${-(dist % TILE)},0)`);
      signs.forEach(s => {
        const x = VAN_X + 420 + (s.k - km) * PX_PER_KM;
        s.el.setAttribute('transform', `translate(${x.toFixed(1)},878)`);
        s.el.style.display = x > -300 && x < 2300 ? '' : 'none';
      });
      const sunY = 300 + km * 4.4;
      sunG.setAttribute('transform', `translate(1260,${sunY.toFixed(1)})`);
      sunDisc.setAttribute('fill', mixHex('#fff3cc', '#ff9b6b', clamp(km / 100, 0, 1)));
      stars.setAttribute('opacity', clamp((km - 80) / 16, 0, 1).toFixed(3));
      names.forEach((n, i) => {
        const w = i === a ? 1 - t : 0 + (i === b ? t : 0);
        n.setAttribute('opacity', (w * 0.2).toFixed(3));
      });
      const bounce = Math.sin(km * 37) * 1.6 + Math.sin(km * 91) * 0.8;
      van.setAttribute('transform', `translate(${VAN_X},${VAN_Y}) scale(${VAN_SCALE})`);
      body.setAttribute('transform', `translate(0,${bounce.toFixed(2)})`);
      const spin = (dist / (2 * Math.PI * 26)) * 360;
      wheels.forEach(({ w, cx }) => w.setAttribute('transform', `rotate(${(spin % 360).toFixed(1)} ${cx} -26)`));
      puffDots.forEach((c, i) => {
        const ph = ((km * 6 + i / 3) % 1);
        c.setAttribute('cx', (-6 - ph * 70).toFixed(1));
        c.setAttribute('cy', (-48 - ph * 26).toFixed(1));
        c.setAttribute('r', (5 + ph * 12).toFixed(1));
        c.setAttribute('opacity', (km > 0.05 ? 1 - ph : 0).toFixed(2));
      });
      hudNum.textContent = km.toFixed(1).padStart(5, '0');
      hud.style.setProperty('--km', `${km.toFixed(2)}%`);
      const label = t > 0.5 ? B.name : A.name;
      if (label !== shownBiome) {
        shownBiome = label;
        gsap.fromTo(hudBiome, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', onStart: () => { hudBiome.textContent = label; } });
      }
      copy.style.opacity = (1 - clamp((p - 0.1) / 0.1, 0, 1)).toFixed(3);
      copy.style.transform = `translateY(${(-clamp((p - 0.1) / 0.1, 0, 1) * 40).toFixed(1)}px)`;
      hud.style.opacity = clamp((p - 0.06) / 0.08, 0, 1).toFixed(3);
      hint.style.opacity = (1 - clamp(p / 0.06, 0, 1)).toFixed(3);
    };
  }

  // Frame sequences rendered from the real .blend, drawn on canvas as you scroll.
  function sequencePlayer(canvas) {
    const name = canvas.dataset.seq;
    const n = Number(canvas.dataset.frames);
    const small = innerWidth < 700;
    const url = i => `media/seq/${name}${small ? '-s' : ''}/${name}-${String(i).padStart(2, '0')}.webp`;
    const imgs = new Array(n);
    const ctx = canvas.getContext('2d');
    let wanted = 0, drawn = -1, started = false;

    function paint(k) {
      const img = imgs[k];
      const cw = canvas.width, ch = canvas.height;
      const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
      const w = img.naturalWidth * s, h = img.naturalHeight * s;
      ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
      drawn = k;
    }
    function draw(f, force = false) {
      wanted = Math.round(clamp(f, 0, n - 1));
      for (let d = 0; d < n; d++) {
        for (const k of [wanted - d, wanted + d]) {
          const img = imgs[k];
          if (img && img.complete && img.naturalWidth) {
            if (k !== drawn || force) paint(k);
            return;
          }
        }
      }
    }
    function resize() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      if (drawn >= 0) draw(wanted, true);
    }
    function load() {
      if (started) return;
      started = true;
      // Coarse frames first, then fill the gaps, so scrubbing works early.
      const order = [];
      for (const step of [8, 4, 2, 1]) for (let i = 0; i < n; i += step) if (!order.includes(i)) order.push(i);
      order.forEach(i => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
          if (drawn < 0) { canvas.classList.add('is-ready'); draw(wanted, true); }
          else if (Math.abs(i - wanted) < Math.abs(drawn - wanted)) draw(wanted, true);
        };
        img.src = url(i);
        imgs[i] = img;
      });
    }
    new IntersectionObserver(([e]) => { if (e.isIntersecting) load(); }, { rootMargin: '1600px 0px' }).observe(canvas);
    new ResizeObserver(resize).observe(canvas);
    resize();
    return { draw, n };
  }

  function cozyScenes() {
    const render = driveScene();
    render(0);
    ScrollTrigger.create({
      trigger: '.drive', start: 'top top', end: '+=380%', pin: true, scrub: 0.6,
      onUpdate: self => render(self.progress),
    });

    const turn = sequencePlayer($('.turn .seq'));
    const turnWord = $('.turn-word span');
    ScrollTrigger.create({
      trigger: '.turn', start: 'top top', end: '+=190%', pin: true, scrub: 0.4,
      onUpdate: self => {
        turn.draw(self.progress * (turn.n - 1));
        turnWord.style.transform = `translateX(${(-self.progress * 38).toFixed(2)}%)`;
      },
    });
    gsap.from('.turn-specs li', {
      opacity: 0, x: 30, duration: 1, ease: 'expo.out', stagger: 0.12,
      scrollTrigger: { trigger: '.turn', start: 'top 40%', once: true },
    });
    gsap.fromTo('.turn-frame', { scale: 0.86, rotate: -2 }, {
      scale: 1, rotate: 0, ease: 'none',
      scrollTrigger: { trigger: '.turn', start: 'top bottom', end: 'top top', scrub: true },
    });

    const explode = sequencePlayer($('.explode .seq'));
    const items = $$('.explode-list li');
    ScrollTrigger.create({
      trigger: '.explode', start: 'top top', end: '+=210%', pin: true, scrub: 0.4,
      onUpdate: self => {
        const p = self.progress;
        explode.draw(clamp((p - 0.05) / 0.85, 0, 1) * (explode.n - 1));
        items.forEach(li => li.classList.toggle('is-on', p >= Number(li.dataset.at)));
      },
    });

    // Interior: a slow camera move through four renders.
    const frames = $$('.cabin-frames img');
    const caps = $$('.cabin-captions li');
    const bar = $('.cabin-progress span');
    const F = frames.length;
    let activeCap = 0;
    function renderCabin(p) {
      const f = p * (F - 1);
      const seg = Math.floor(f), local0 = f - seg;
      frames.forEach((img, i) => {
        // Each view holds, then the next one fades in over the last third of the segment.
        let o = i <= seg ? 1 : 0;
        if (i === seg + 1) o = clamp((local0 - 0.66) / 0.34, 0, 1);
        const local = clamp(f - i + 1, 0, 2) / 2;
        img.style.opacity = o.toFixed(3);
        img.style.transform = `scale(${(1.16 - local * 0.12).toFixed(4)}) translateX(${((local - 0.5) * -3).toFixed(2)}%)`;
      });
      const cap = Math.min(F - 1, local0 > 0.83 ? seg + 1 : seg);
      if (cap !== activeCap) {
        activeCap = cap;
        caps.forEach((li, i) => li.classList.toggle('is-active', i === cap));
      }
      bar.style.transform = `scaleX(${p.toFixed(4)})`;
    }
    renderCabin(0);
    ScrollTrigger.create({
      trigger: '.cabin', start: 'top top', end: '+=280%', pin: true, scrub: 0.5,
      onUpdate: self => renderCabin(self.progress),
    });

    $$('.trip-col').forEach(col => {
      const s = Number(col.dataset.speed);
      gsap.fromTo(col, { yPercent: -s * 60 }, {
        yPercent: s * 60, ease: 'none',
        scrollTrigger: { trigger: '.trip-cols', start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });
    gsap.from('.unity-grid figure', {
      y: 60, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.12,
      scrollTrigger: { trigger: '.unity-grid', start: 'top 85%', once: true },
    });
  }

  // Wireframe / render comparison: the visitor drags it; until then, scroll sweeps it.
  function compareScene() {
    const box = $('.compare');
    if (!box) return;
    const handle = $('.compare-handle', box);
    let touched = false;
    const set = v => {
      const pct = clamp(v, 0, 100);
      box.style.setProperty('--pos', `${pct.toFixed(2)}%`);
      handle.setAttribute('aria-valuenow', String(Math.round(pct)));
    };
    const fromEvent = e => {
      const r = box.getBoundingClientRect();
      set(((e.clientX - r.left) / r.width) * 100);
    };
    let dragging = false;
    box.addEventListener('pointerdown', e => { dragging = true; touched = true; fromEvent(e); });
    addEventListener('pointermove', e => { if (dragging) fromEvent(e); });
    addEventListener('pointerup', () => { dragging = false; });
    handle.addEventListener('keydown', e => {
      const now = Number(handle.getAttribute('aria-valuenow'));
      if (e.key === 'ArrowLeft') { touched = true; set(now - 5); e.preventDefault(); }
      if (e.key === 'ArrowRight') { touched = true; set(now + 5); e.preventDefault(); }
    });
    set(reduced ? 50 : 88);
    if (!reduced) {
      ScrollTrigger.create({
        trigger: box, start: 'top 85%', end: 'bottom 35%', scrub: true,
        onUpdate: self => { if (!touched) set(88 - self.progress * 76); },
      });
    }
  }

  function cozyStatic() {
    const render = driveScene();
    render(0);
    const poster = $('.explode .seq-poster');
    if (poster) poster.src = 'media/seq/explode/explode-39.webp';
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */
  if (!reduced) {
    heroScene();
    reelScene();
    cozyScenes();
    aehScenes();
    bistroScenes();
    mimoScenes();
    dumplingScenes();
    processScenes();
  }
  if (reduced) cozyStatic();
  compareScene();
  despertaversoScene();
  revealHeadings();
  pointerToys();

  // Theme + chapter triggers go last so they measure the final, pinned layout.
  $$('section[data-theme]').forEach(section => {
    const spacer = section.parentElement.classList.contains('pin-spacer') ? section.parentElement : section;
    ScrollTrigger.create({
      trigger: spacer, start: section.dataset.themeStart || 'top 55%', end: 'bottom 55%',
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
