import { useEffect, useRef } from 'react';

const TOTAL_FRAMES = 201; // frames 0 to 200
const TRANS_END_FRAME = 112; // frame where rectangular border finishes forming
const LIVING_START_FRAME = 113; // first frame of living breeze sequence
const LIVING_END_FRAME = 200; // last frame of living breeze sequence
const TRANS_SCROLL_THRESHOLD = 0.65; // scroll progress where transformation completes

export default function AyurvedaSequence() {
  const rootRef = useRef(null);
  const pinRef = useRef(null);
  const canvasRef = useRef(null);
  const powerRef = useRef(null);
  const contentRef = useRef(null);
  const hintRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    const pin = pinRef.current;
    const canvas = canvasRef.current;
    const power = powerRef.current;
    const content = contentRef.current;
    const hint = hintRef.current;

    if (!root || !canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    const frames = new Array(TOTAL_FRAMES);
    let lastDrawnIndex = -1;

    const useBitmaps = typeof createImageBitmap === 'function' && typeof fetch === 'function';
    const loaded = (i) => frames[i] !== undefined;
    const bitmaps = new Map();
    const decoding = new Set();
    const AHEAD = 16;
    const BEHIND = 6;
    const KEEP = 26;
    let travel = 1;
    let wanted = 0;

    function warmWindow(center) {
      if (!useBitmaps) return;
      for (let k = -BEHIND; k <= AHEAD; k++) {
        const i = center + k * travel;
        if (i < 0 || i >= TOTAL_FRAMES || bitmaps.has(i) || decoding.has(i) || !loaded(i)) continue;
        if (decoding.size >= 4) break;
        decoding.add(i);
        createImageBitmap(frames[i]).then(
          (bmp) => {
            decoding.delete(i);
            if (Math.abs(i - wanted) > KEEP) {
              if (bmp.close) bmp.close();
              return;
            }
            bitmaps.set(i, bmp);
            drawFrame(wanted);
            warmWindow(wanted);
          },
          () => decoding.delete(i)
        );
      }
      for (const [i, bmp] of bitmaps) {
        if (Math.abs(i - center) > KEEP) {
          if (bmp.close) bmp.close();
          bitmaps.delete(i);
        }
      }
    }

    function drawFrame(index) {
      const want = Math.max(0, Math.min(TOTAL_FRAMES - 1, Math.round(index)));
      if (want !== wanted) {
        travel = want > wanted ? 1 : -1;
        wanted = want;
      }
      const has = useBitmaps ? (i) => bitmaps.has(i) : (i) => loaded(i) && frames[i].naturalWidth > 0;
      if (useBitmaps) warmWindow(want);

      let idx = -1;
      for (let d = 0; d < TOTAL_FRAMES && idx < 0; d++) {
        if (want - d >= 0 && has(want - d)) idx = want - d;
        else if (want + d < TOTAL_FRAMES && has(want + d)) idx = want + d;
      }
      if (idx < 0) return false;
      if (idx === lastDrawnIndex) return idx === want;

      ctx.drawImage(useBitmaps ? bitmaps.get(idx) : frames[idx], 0, 0, canvas.width, canvas.height);
      lastDrawnIndex = idx;
      return idx === want;
    }

    const frameUrl = (i) => `/frames/ayurveda/frame_${String(i).padStart(3, '0')}.webp`;
    const order = [];
    {
      const seen = new Set();
      for (const step of [16, 8, 4, 2, 1]) {
        for (let i = 0; i < TOTAL_FRAMES; i += step) {
          if (!seen.has(i)) {
            seen.add(i);
            order.push(i);
          }
        }
      }
      if (!seen.has(TOTAL_FRAMES - 1)) order.push(TOTAL_FRAMES - 1);
    }

    let started = false;
    function loadFrames() {
      if (started) return;
      started = true;
      let next = 0;
      const arrived = (i) => {
        if (useBitmaps) {
          if (lastDrawnIndex < 0 || Math.abs(i - wanted) <= AHEAD) warmWindow(wanted);
        } else if (lastDrawnIndex < 0 || Math.abs(i - wanted) <= 2) {
          drawFrame(wanted);
        }
      };

      const pump = () => {
        if (next >= order.length) return;
        const i = order[next++];
        if (useBitmaps) {
          fetch(frameUrl(i))
            .then((r) => (r.ok ? r.blob() : null))
            .then((blob) => {
              if (blob) {
                frames[i] = blob;
                arrived(i);
              }
            }, () => {})
            .finally(pump);
        } else {
          const img = new Image();
          img.decoding = 'async';
          img.onload = () => {
            frames[i] = img;
            arrived(i);
            pump();
          };
          img.onerror = pump;
          img.src = frameUrl(i);
        }
      };
      for (let k = 0; k < 6; k++) pump();
    }

    let nearObserver = null;
    if ('IntersectionObserver' in window) {
      nearObserver = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            loadFrames();
            nearObserver.disconnect();
          }
        },
        { rootMargin: '200% 0px' }
      );
      nearObserver.observe(root);
    } else {
      loadFrames();
    }

    const styleCache = new WeakMap();
    const setStyle = (el, prop, value) => {
      if (!el) return;
      let c = styleCache.get(el);
      if (!c) {
        c = {};
        styleCache.set(el, c);
      }
      if (c[prop] === value) return;
      c[prop] = value;
      el.style[prop] = value;
    };

    let curP = 0;
    let targetP = 0;
    let lastTime = performance.now();
    let livingIdx = LIVING_START_FRAME;
    let livingDir = 1;
    let lastLivingStep = performance.now();
    let isVisible = false;
    let rafId = null;

    function clamp(val, min, max) {
      return Math.max(min, Math.min(max, val));
    }

    function tick(now) {
      if (!isVisible) {
        rafId = null;
        return;
      }
      rafId = requestAnimationFrame(tick);

      const rect = root.getBoundingClientRect();
      const vh = window.innerHeight;

      if (rect.bottom < 0 || rect.top > vh) {
        lastTime = now;
        return;
      }

      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      const travel = Math.max(1, rect.height - vh);
      targetP = clamp(-rect.top / travel, 0, 1);

      curP += (targetP - curP) * (1 - Math.exp(-dt * 12));
      if (Math.abs(targetP - curP) < 1e-4) curP = targetP;

      // Overlay text: "Power of Nature in every product"
      if (power) {
        const isMobile = window.innerWidth <= 860;
        const fadeThreshold = 0.32;
        const alpha = clamp(1 - curP / fadeThreshold, 0, 1);
        const shift = (1 - alpha) * (isMobile ? -24 : -36);

        setStyle(power, 'opacity', alpha.toFixed(3));
        if (isMobile) {
          setStyle(power, 'transform', `translate(-50%, -50%) translateY(${shift.toFixed(1)}px)`);
        } else {
          setStyle(power, 'transform', `translateY(-50%) translateX(${shift.toFixed(1)}px)`);
        }
        setStyle(power, 'pointerEvents', alpha > 0.05 ? 'auto' : 'none');
        const hiddenNow = String(alpha < 0.05);
        if (power.getAttribute('aria-hidden') !== hiddenNow) power.setAttribute('aria-hidden', hiddenNow);
      }

      // Phase 1: Meditating Nature -> Botanical Living Border
      if (curP < TRANS_SCROLL_THRESHOLD) {
        const transProgress = curP / TRANS_SCROLL_THRESHOLD;
        const targetFrame = Math.round(transProgress * TRANS_END_FRAME);
        drawFrame(targetFrame);

        if (content && content.classList.contains('is-visible')) {
          content.classList.remove('is-visible');
        }
        if (hint) {
          setStyle(hint, 'opacity', Math.max(0, 1 - curP * 4).toFixed(3));
        }
      } else {
        // Phase 2: Frame completed! Reveal Ayurveda quote & play continuous living breeze animation
        if (content && !content.classList.contains('is-visible')) {
          content.classList.add('is-visible');
        }
        if (hint) {
          setStyle(hint, 'opacity', '0');
        }

        if (now - lastLivingStep >= 48) {
          lastLivingStep = now;
          livingIdx += livingDir;
          if (livingIdx >= LIVING_END_FRAME) {
            livingIdx = LIVING_END_FRAME;
            livingDir = -1;
          } else if (livingIdx <= LIVING_START_FRAME) {
            livingIdx = LIVING_START_FRAME;
            livingDir = 1;
          }
        }
        drawFrame(livingIdx);
      }

      // Exit transition
      if (curP > 0.92) {
        const exitProgress = clamp((curP - 0.92) / 0.08, 0, 1);
        setStyle(pin, 'opacity', (1 - exitProgress * 0.92).toFixed(3));
        setStyle(pin, 'transform', `translateY(${(-exitProgress * 30).toFixed(1)}px)`);
      } else {
        setStyle(pin, 'opacity', '1');
        setStyle(pin, 'transform', 'none');
      }
    }

    const visObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        isVisible = entry.isIntersecting;
        if (isVisible) {
          lastTime = performance.now();
          if (!rafId) rafId = requestAnimationFrame(tick);
        }
      },
      { rootMargin: '150px 0px' }
    );
    visObserver.observe(root);

    return () => {
      if (nearObserver) nearObserver.disconnect();
      visObserver.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
      for (const bmp of bitmaps.values()) {
        if (bmp.close) bmp.close();
      }
      bitmaps.clear();
    };
  }, []);

  return (
    <section className="ayur-section" id="ayurveda" aria-label="Ayurvedic wisdom">
      <div className="ayur-seq" id="ayurSeq" ref={rootRef}>
        <div className="ayur-pin" id="ayurPin" ref={pinRef}>
          <div className="ayur-viewport">
            <div className="ayur-frame-box">
              <canvas
                id="ayurCanvas"
                ref={canvasRef}
                width={1280}
                height={720}
                className="ayur-canvas"
                aria-label="Meditating botanical woman transforms into an intertwined living botanical border"
              />

              {/* Left-Side Overlay: Power of NATURE In Every Product */}
              <div
                className="ayur-power-overlay"
                id="ayurPower"
                ref={powerRef}
                aria-label="The power of nature in every product"
              >
                <p className="apo-text">
                  <span className="apo-script">Power of</span>
                  <span className="apo-big">Nature</span>
                  <span className="apo-small">in every product</span>
                </p>
              </div>

              {/* Revealed Center Ayurvedic Wisdom Inside Living Botanical Frame */}
              <div className="ayur-content" id="ayurContent" ref={contentRef} aria-live="polite">
                <div className="ayur-pill">
                  <svg viewBox="0 0 20 20" className="ayur-leaf-ic" aria-hidden="true">
                    <path
                      d="M10 2C6 6 4 11 6 15c2 4 7 4 9 2 2-2 1-7-3-9-2-1-2-6-2-6z"
                      fill="currentColor"
                    />
                  </svg>
                  <span>Ayurvedic Wisdom</span>
                </div>

                <h3 className="ayur-quote">
                  <span className="aq-quote-mark" aria-hidden="true">“</span>
                  Health in Ayurveda means the body is <strong className="aq-accent">free of toxins</strong>; the mind
                  is <strong className="aq-accent">at peace</strong>, the emotions are{' '}
                  <strong className="aq-accent">calm &amp; happy</strong>, wastes are{' '}
                  <strong className="aq-accent">efficiently eliminated</strong>, the organs{' '}
                  <strong className="aq-accent">function normally</strong> and the immune system is{' '}
                  <strong className="aq-accent">strong</strong>.
                  <span className="aq-quote-mark" aria-hidden="true">”</span>
                </h3>

                <div className="ayur-sign">
                  <div className="ayur-sign-line" aria-hidden="true" />
                  <div className="ayur-sign-meta">
                    <span className="ayur-brand">TranzLife Biosciences</span>
                    <span className="ayur-tag">Rooted in Nature · Perfected by Science</span>
                  </div>
                  <div className="ayur-sign-line" aria-hidden="true" />
                </div>

                <div className="ayur-cta-row">
                  <a href="#products" className="ayur-cta-btn">
                    Discover our formulations ↓
                  </a>
                </div>
              </div>
            </div>

            {/* Scroll Hint */}
            <div className="ayur-hint" id="ayurHint" ref={hintRef} aria-hidden="true">
              <div className="ah-mouse">
                <span className="ah-wheel" />
              </div>
              <span className="ah-text">Scroll to transform</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
