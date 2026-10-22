/* Jobscan — Concept 2.
   1. Loader counts real page loading (fonts, images, window load).
   2. The scroll scene morphs Desktop 1 → 2 → 3 → 4 from the Figma section,
      every element interpolating between its exact positions in the frames. */

(() => {
  const root = document.documentElement;
  const body = document.body;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  /* ---------- Canvas scale ---------- */

  const CANVAS_W = 1440;
  const CANVAS_H = 810;
  const scene = document.getElementById('scene');
  let scale = 1;
  let scrollLen = 0;
  let extraW = 0; // canvas px added to the 1440 width on short, wide windows

  function resize() {
    const vw = root.clientWidth;
    const vh = window.innerHeight;
    // Fit the 810px height when the window is wider than 16:9 so nothing is
    // cut off at the bottom; the extra width goes to the Autopilot panel.
    scale = Math.min(vw / CANVAS_W, vh / CANVAS_H);
    const canvasW = vw / scale;
    extraW = canvasW - CANVAS_W;
    root.style.setProperty('--cw', canvasW + 'px');
    const stageH = CANVAS_H * scale;
    scrollLen = Math.max(vh, stageH) * 3.6;
    root.style.setProperty('--s', scale);
    root.style.setProperty('--stage-top', Math.max(0, (vh - stageH) / 2) + 'px');
    // Leave exactly scrollLen of scrolling even when the window is taller than
    // the stage, so the scene always reaches its last frame (Desktop 4).
    scene.style.height = Math.max(vh, stageH) + scrollLen + 'px';
    render();
  }

  /* ---------- Helpers ---------- */

  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const seg = (v, a, b) => clamp01((v - a) / (b - a));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mixColor = (a, b, t) => {
    const ca = hex(a);
    const cb = hex(b);
    return `rgb(${ca.map((c, i) => Math.round(lerp(c, cb[i], t))).join(',')})`;
  };

  const el = {};
  document.querySelectorAll('[data-el]').forEach((node) => { el[node.dataset.el] = node; });

  /* ---------- Frame geometry (Figma px) ----------
     Arrays are [Desktop 1, Desktop 2, Desktop 3, Desktop 4].
     Panel children use dx = offset of their centre from the panel centre. */

  const F = {
    hero:  { x: [0, 20, 20, 20], y: [0, 25, 24, 24], w: [746, 411, 411, 411], h: [810, 761, 761, 761], r: [8, 12, 12, 12] },
    copyY: [365, 344, 344, 344],
    dropY: [635, 555, 555, 555],
    dropR: [20, 8, 8, 8],
    panel: { x: [746, 342, 20, 42], y: [0, 25, 24, -603], w: [694, 1078, 1400, 1356], h: [810, 761, 761, 727], r: [0, 12, 12, 12] },
    mountains: { dx: [0, 0, 0, 22], y: [-2, 0, -15.94, -15.94], w: [1435.58, 1345.42, 1400, 1400], h: [812, 761, 791.88, 791.88] },
    grad: { dx: [1, 176.5, 17.5, 17.5], y: [0, -154, -309, -309], w: [696, 1465, 1465, 1465], h: [810, 1070, 1070, 1070] },
    hazeBottom: [0, 0, 0, -34],
    hazeDx: [0, 0, 0, 22],
    // Desktop 4 keeps the Desktop 3 plate so the match result rides up with the panel
    glass: { dx: [1, .5, -.5, -.5], y: [233, 212, 213, 213], w: [417, 585, 567, 567], h: [344, 338, 392, 392] },
    analyzing: { dx: [1, .5, -.5, -.5], y: [390, 353, 416, 416], w: [399, 567, 567, 567], h: [180, 189, 189, 189] },
    analyzingLine: { dx: [4.5, .5, .5, .5], w: [360, 520, 520, 520] },
    // vacancy cards: dx of the card centre, top, scale of the 540.028px card
    cardBack:    { dx: [1, .5, 0, 0], y: [287.98, 247.95, 200, 200], s: [.45368, .54973, .7, .7] },
    cardPython:  { dx: [1, .5, 0, 0], y: [310.76, 275.55, 230, 230], s: [.66478, .80551, .85, .85] },
    cardBackend: { dx: [1, .5, .01, .01], y: [296, 188.6, 176, 176], s: [.54257, .65742, 1, 1], r: [18.555, 18.555, 13.55, 13.55] },
    // back card: Desktop 1 has the feedback chip at the right edge and no status; Desktop 2 adds "open"
    backChipX: [415.95, 356.44, 356.44, 356.44],
  };

  const CARD_W = 540.028;
  const OUTRO_SHIFT = 627; // how far the panel travels up between Desktop 3 and Desktop 4

  let pA = 0; // Desktop 1 → 2
  let pB = 0; // Desktop 2 → 3
  let pC = 0; // Desktop 3 → 4
  let A = 0;
  let B = 0;
  let C = 0;

  // Value of a 4-state property for the current scroll position.
  const v = (arr) => lerp(lerp(lerp(arr[0], arr[1], A), arr[2], B), arr[3], C);

  function box(node, x, y, w, h) {
    node.style.left = x + 'px';
    node.style.top = y + 'px';
    node.style.width = w + 'px';
    node.style.height = h + 'px';
  }

  function panelBox(node, g, pw, grow = 0) {
    const w = v(g.w) + grow;
    box(node, pw / 2 + v(g.dx) - w / 2, v(g.y), w, v(g.h));
  }

  // Mountains keep their proportions and are enlarged about their centre
  // whenever a wider panel would otherwise uncover their sides.
  function mountainsBox(node, pw) {
    const g = F.mountains;
    const k = Math.max(1, (pw + 2 * Math.abs(v(g.dx))) / v(g.w));
    const w = v(g.w) * k;
    const h = v(g.h) * k;
    const cy = v(g.y) + v(g.h) / 2;
    box(node, pw / 2 + v(g.dx) - w / 2, cy - h / 2, w, h);
  }

  function card(node, g, pw, extraTop = 0) {
    const s = v(g.s);
    const x = pw / 2 + v(g.dx) - (CARD_W * s) / 2;
    node.style.transform = `translate(${x}px, ${v(g.y) + extraTop}px) scale(${s})`;
  }

  /* ---------- Count-up for the match scores ---------- */

  const counters = Array.from(document.querySelectorAll('[data-count]'));
  let lastCount = -1;

  function renderCounts(t) {
    const k = Math.round(t * 1000);
    if (k === lastCount) return;
    lastCount = k;
    counters.forEach((node) => {
      node.textContent = Math.round(Number(node.dataset.count) * t) + node.dataset.suffix;
    });
  }

  /* ---------- Render ---------- */

  function render() {
    const rect = scene.getBoundingClientRect();
    const p = scrollLen ? clamp01(-rect.top / scrollLen) : 0;

    pA = seg(p, .06, .36);
    pB = seg(p, .36, .62);
    pC = seg(p, .72, 1);
    A = ease(pA);
    B = ease(pB);
    C = ease(pC);

    // Page background: white → #e8ebf2; Desktop 4 gradient fades in on top
    const bg = mixColor('#ffffff', '#e8ebf2', A);
    el.hero.parentNode.style.background = bg;
    // Letterbox around the canvas on tall windows: match the outro's top and bottom colours
    body.style.background = C > .5 ? 'linear-gradient(#e8ebf2 50%, #fff 50%) fixed' : bg;
    el.outroBg.style.opacity = C;
    el.outro.style.transform = `translateY(${(1 - C) * OUTRO_SHIFT}px)`;

    // Left white card
    const h = F.hero;
    box(el.hero, v(h.x), v(h.y), v(h.w), v(h.h));
    el.hero.style.borderRadius = v(h.r) + 'px';
    el.heroInner.style.opacity = lerp(1, .02, A);
    el.hero.style.visibility = B >= 1 ? 'hidden' : '';
    el.heroCopy.style.top = v(F.copyY) + 'px';
    el.drop.style.top = v(F.dropY) + 'px';
    el.drop.style.borderRadius = v(F.dropR) + 'px';

    // Autopilot panel
    const pg = F.panel;
    const pw = v(pg.w) + extraW;
    const ph = v(pg.h);
    box(el.panel, v(pg.x), v(pg.y), pw, ph);
    el.panel.style.borderRadius = v(pg.r) + 'px';
    el.panel.style.background = mixColor('#0044c1', '#020202', A);

    mountainsBox(el.mountains, pw);
    panelBox(el.grad1, F.grad, pw, extraW);
    panelBox(el.grad2, F.grad, pw, extraW);
    el.grad1.style.opacity = 1 - A;
    el.grad2.style.opacity = A * (1 - C);

    el.haze.style.width = 1400 + extraW + 'px';
    el.haze.style.left = pw / 2 + v(F.hazeDx) - (1400 + extraW) / 2 + 'px';
    el.haze.style.top = ph - 212 - v(F.hazeBottom) + 'px';
    el.haze.style.opacity = B;

    el.shade.style.left = pw / 2 + .5 - (1355 + extraW) / 2 + 'px';
    el.shade.style.top = '-65px';
    el.shade.style.width = 1355 + extraW + 'px';
    el.shade.style.height = '851px';
    el.shade.style.opacity = C;

    el.ats.style.left = pw / 2 + 14 - 274 + 'px';
    el.ats.style.opacity = 1 - ease(seg(pA, 0, .5));

    // While the outro comes in, the panel content drifts up faster than the
    // panel so none of it peeks out of the strip left on screen.
    const drift = -170 * ease(seg(pC, 0, .8));

    panelBox(el.glass, F.glass, pw);
    el.glass.style.top = v(F.glass.y) + drift + 'px';
    panelBox(el.analyzing, F.analyzing, pw);
    el.analyzing.style.setProperty('--fade', 1 - ease(seg(pB, 0, .5)));
    const lw = v(F.analyzingLine.w);
    el.analyzingLine.style.width = lw + 'px';
    el.analyzingLine.style.left = v(F.analyzing.w) / 2 + v(F.analyzingLine.dx) - lw / 2 + 'px';

    // Cards: the middle Backend card lifts out of the stack and lands on top
    card(el.cardBack, F.cardBack, pw);
    card(el.cardPython, F.cardPython, pw);
    card(el.cardBackend, F.cardBackend, pw, (pA > 0 && pA < 1 ? liftOffset(pA) : 0) + drift);

    el.cardBack.style.opacity = 1 - ease(seg(pB, 0, .55));
    el.cardPython.style.opacity = 1 - ease(seg(pB, 0, .55));
    el.cardBackend.style.zIndex = pA >= .5 ? 7 : 5;
    el.cardPython.style.zIndex = 6;

    el.cardBackend.style.background = mixColor('#eae9e6', '#faf9f6', A);
    el.cardBackend.style.borderRadius = v(F.cardBackend.r) + 'px';
    el.cardPython.style.background = mixColor('#faf9f6', '#eae9e6', A);
    el.pythonChip.style.background = mixColor('#f0eee5', '#e0ded6', A);
    el.backChip.style.left = v(F.backChipX) + 'px';
    const status = ease(seg(pA, .35, 1));
    el.backStatus.style.opacity = status;
    el.backStatus.style.transform = `scale(${lerp(.6, 1, status)})`;

    // Desktop 3 content stays put and leaves with the panel
    const d3In = ease(seg(pB, .5, 1));
    el.stepsRow.style.opacity = d3In;
    el.lede.style.opacity = d3In;
    el.stepsRow.style.top = 74 + drift + 'px';
    el.lede.style.top = 657 + drift + 'px';
    el.match.style.opacity = ease(seg(pB, .55, 1));
    renderCounts(ease(seg(pB, .55, 1)));
  }

  // Extra vertical offset that makes the Backend card rise above the Python
  // card before it swaps to the front (Desktop 1 → 2).
  function liftOffset(t) {
    const straight = lerp(F.cardBackend.y[0], F.cardBackend.y[1], ease(t));
    const arc = t < .5
      ? lerp(F.cardBackend.y[0], 150, ease(t / .5))
      : lerp(150, F.cardBackend.y[1], ease((t - .5) / .5));
    return arc - straight;
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      render();
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', resize);
  resize();

  /* ---------- Resume drop zone ---------- */

  const drop = el.drop;
  const input = document.getElementById('resumeInput');
  const hint = document.getElementById('dropHint');
  const hintDefault = hint.textContent;

  function takeFile(file) {
    if (!file) return;
    const ok = /\.(pdf|docx)$/i.test(file.name);
    hint.textContent = ok ? `${file.name} · ready to scan` : 'Please use a PDF or DOCX file';
    if (!ok) setTimeout(() => { hint.textContent = hintDefault; }, 2400);
  }

  input.addEventListener('change', () => takeFile(input.files[0]));
  ['dragenter', 'dragover'].forEach((type) => drop.addEventListener(type, (e) => {
    e.preventDefault();
    drop.classList.add('is-dragover');
  }));
  ['dragleave', 'drop'].forEach((type) => drop.addEventListener(type, (e) => {
    e.preventDefault();
    drop.classList.remove('is-dragover');
  }));
  drop.addEventListener('drop', (e) => takeFile(e.dataTransfer.files[0]));

  /* ---------- Typing ---------- */

  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const keyDelay = (speed) => speed * (.55 + Math.random() * .9);

  async function typeText(node, text, speed = 36) {
    for (let i = node.textContent.length; i <= text.length; i += 1) {
      node.textContent = text.slice(0, i);
      await wait(keyDelay(speed));
    }
  }

  async function eraseText(node, speed = 16) {
    while (node.textContent.length) {
      node.textContent = node.textContent.slice(0, -1);
      await wait(speed);
    }
  }

  /* ---------- Hero intro ---------- */

  // Wraps every word in .{cls} > .{cls}__in so it can rise out of its own mask.
  // Hyphenated words are split after the hyphen to keep the original line breaks.
  function splitWords(node, cls) {
    const words = [];
    const walk = (parent) => {
      Array.from(parent.childNodes).forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          walk(child);
          return;
        }
        if (child.nodeType !== Node.TEXT_NODE) return;
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) {
            frag.append(part);
            return;
          }
          part.split(/(?<=-)/).forEach((piece, i) => {
            if (i) frag.append(document.createElement('wbr'));
            const word = document.createElement('span');
            const inner = document.createElement('span');
            word.className = cls;
            inner.className = `${cls}__in`;
            inner.textContent = piece;
            word.append(inner);
            frag.append(word);
            words.push(word);
          });
        });
        parent.replaceChild(frag, child);
      });
    };
    walk(node);
    return words;
  }

  function prepareIntro() {
    const title = document.querySelector('.hero__title');
    const titleWords = splitWords(title, 'word');
    title.classList.add('is-split');
    // Each word carries its slice of the title's left-to-right gradient
    title.style.setProperty('--tw', title.offsetWidth + 'px');
    titleWords.forEach((word, i) => {
      word.style.setProperty('--d', (.45 + i * .06).toFixed(3) + 's');
      word.firstChild.style.setProperty('--wx', -(word.offsetLeft - title.offsetLeft) + 'px');
    });

    splitWords(document.querySelector('.hero__text'), 'pw').forEach((word, i) => {
      word.style.setProperty('--d', (.95 + i * .018).toFixed(3) + 's');
    });
  }

  /* ---------- Loader ---------- */

  const loader = document.getElementById('loader');
  const bar = document.getElementById('loaderBar');
  const pctNode = document.getElementById('loaderPct');
  const slashes = document.getElementById('loaderSlashes');
  const caption = document.getElementById('loaderCaption');
  const CAPTIONS = ['Initializing Autopilot Engine...', 'Mapping high-stakes career topography...'];
  const MIN_TIME = reduceMotion ? 400 : 3600;
  const SLASHES_AT_57 = 39; // as in the 57% frame

  const tasks = [];
  const images = Array.from(document.images);
  images.forEach((img) => {
    tasks.push(img.complete ? Promise.resolve() : new Promise((res) => {
      img.addEventListener('load', res, { once: true });
      img.addEventListener('error', res, { once: true });
    }));
  });
  if (document.fonts && document.fonts.ready) tasks.push(document.fonts.ready);
  tasks.push(new Promise((res) => {
    if (document.readyState === 'complete') res();
    else window.addEventListener('load', res, { once: true });
  }));

  let done = 0;
  tasks.forEach((t) => t.then(() => { done += 1; }));

  // Caption: type the first line, swap to the second at 50%, finish only once it is typed
  let captionStep = 'typing';
  if (reduceMotion) {
    captionStep = 'first';
  } else {
    caption.textContent = '';
    wait(250).then(() => typeText(caption, CAPTIONS[0])).then(() => { captionStep = 'first'; });
  }

  function switchCaption() {
    captionStep = 'switching';
    if (reduceMotion) {
      caption.textContent = CAPTIONS[1];
      captionStep = 'second';
      return;
    }
    eraseText(caption)
      .then(() => wait(180))
      .then(() => typeText(caption, CAPTIONS[1]))
      .then(() => wait(500))
      .then(() => { captionStep = 'second'; });
  }

  const start = performance.now();
  let shown = 0;

  function tickLoader(now) {
    const elapsed = now - start;
    const loaded = done / tasks.length;
    const timeCap = clamp01(elapsed / MIN_TIME);
    const target = Math.min(loaded, timeCap) * 100;
    shown += (target - shown) * .12;
    if (target === 100 && 100 - shown < .5) shown = 100;

    const pct = Math.floor(shown);
    pctNode.textContent = `[${String(pct).padStart(2, '0')}%]`;
    if (pct > 0) bar.classList.remove('is-idle');
    slashes.textContent = '/'.repeat(Math.round((shown / 57) * SLASHES_AT_57));
    if (shown >= 50 && captionStep === 'first') switchCaption();

    if (shown >= 100 && captionStep === 'second') {
      setTimeout(finishLoader, reduceMotion ? 0 : 350);
      return;
    }
    requestAnimationFrame(tickLoader);
  }

  function finishLoader() {
    window.scrollTo(0, 0);
    render();
    prepareIntro();
    loader.classList.add('is-done');
    body.classList.remove('is-loading');
    body.classList.add('is-ready');
  }

  requestAnimationFrame(tickLoader);
})();
