import { useEffect } from 'react';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * Before / after style comparison drag (same behaviour as the original product-page stage).
 * The stage's `--pos` CSS variable (0..100) is where the handle stands. The left picture shows to the
 * left of the handle, the right (clipped) picture to its right.
 *  - drag or tap anywhere on the stage (touch-action: pan-y keeps vertical page scrolling on phones);
 *    the handle eases towards the pointer every frame
 *  - keyboard: the handle is a slider (arrows, Shift + arrows, Home / End)
 *  - the first time it is seen, the handle sweeps once so it is obvious it can be moved
 *    (not with reduced motion, and never after the visitor has touched it)
 * `names` = [leftName, rightName], used for the screen-reader value text.
 */
export default function useCompare(stageRef, handleRef, names = ['before', 'after']) {
  useEffect(() => {
    const stage = stageRef.current, handle = handleRef.current;
    if (!stage || !handle) return undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let pos = 50, target = 50, raf = 0, rect = null, dragging = false, touched = false, demo = null, lastV = -1, timer = 0, io = null;

    const write = () => {
      stage.style.setProperty('--pos', pos.toFixed(2));
      const v = Math.round(pos);
      if (v !== lastV) {
        lastV = v;
        handle.setAttribute('aria-valuenow', String(v));
        handle.setAttribute(
          'aria-valuetext',
          v <= 2 ? `All ${names[0]}` : v >= 98 ? `All ${names[1]}` : `${v}% ${names[0]}, ${100 - v}% ${names[1]}`
        );
      }
    };
    // ease the shown position towards the target; stop once it has arrived
    const step = (now) => {
      raf = 0;
      if (demo) {
        const t = (now - demo.t0) / demo.ms;
        if (t >= 1) { demo = null; target = 50; }
        else target = 50 + Math.sin(t * Math.PI * 2) * -22 * (1 - t * 0.35); // 50 -> 28 -> 72 -> 50
      }
      pos += (target - pos) * (dragging ? 0.45 : 0.22);
      if (Math.abs(target - pos) < 0.05 && !demo) pos = target;
      write();
      if (pos !== target || demo) raf = requestAnimationFrame(step);
    };
    const go = (p) => { target = clamp(p, 0, 100); if (!raf) raf = requestAnimationFrame(step); };
    const stopDemo = () => { touched = true; demo = null; };
    const fromX = (x) => (rect ? ((x - rect.left) / rect.width) * 100 : pos);

    const down = (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      stopDemo();
      rect = stage.getBoundingClientRect();
      dragging = true;
      stage.classList.add('is-dragging');
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      go(fromX(e.clientX));
    };
    const move = (e) => { if (dragging) go(fromX(e.clientX)); };
    const end = (e) => {
      if (!dragging) return;
      dragging = false;
      stage.classList.remove('is-dragging');
      try { stage.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    };
    const lost = () => { dragging = false; stage.classList.remove('is-dragging'); };
    const key = (e) => {
      const big = e.shiftKey ? 10 : 4;
      const map = { ArrowLeft: -big, ArrowDown: -big, ArrowRight: big, ArrowUp: big };
      if (e.key in map) { e.preventDefault(); stopDemo(); go(target + map[e.key]); }
      else if (e.key === 'Home') { e.preventDefault(); stopDemo(); go(0); }
      else if (e.key === 'End') { e.preventDefault(); stopDemo(); go(100); }
    };

    stage.addEventListener('pointerdown', down);
    stage.addEventListener('pointermove', move);
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
    stage.addEventListener('lostpointercapture', lost);
    handle.addEventListener('keydown', key);

    if (!reduce && 'IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        timer = setTimeout(() => { if (!touched) { demo = { t0: performance.now(), ms: 2400 }; go(50); } }, 450);
      }, { threshold: 0.55 });
      io.observe(stage);
    }
    write();

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      if (io) io.disconnect();
      stage.removeEventListener('pointerdown', down);
      stage.removeEventListener('pointermove', move);
      stage.removeEventListener('pointerup', end);
      stage.removeEventListener('pointercancel', end);
      stage.removeEventListener('lostpointercapture', lost);
      handle.removeEventListener('keydown', key);
    };
  }, [stageRef, handleRef, names]);
}
