import * as THREE from 'three';
import { KT } from './plane.js';

// The head-up display of the simulator, drawn on a 2D canvas over the 3D view.

const GREEN = '#7dffb0';
const AMBER = '#ffc857';
const RED = '#ff6b6b';
const MONO = '600 15px ui-monospace, Menlo, Consolas, monospace';
const v = new THREE.Vector3();

export function createHud(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0;
  let h = 0;
  let dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function glow(color = GREEN, blur = 6) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  }

  function project(camera, position) {
    v.copy(position).project(camera);
    return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, behind: v.z > 1 };
  }

  function tape(x, side, value, { unit, step, band, label, format }) {
    // A vertical scale with the value in a box and an optional "good" band.
    const cy = h / 2;
    const span = 220;
    const perPx = step / 38; // value per pixel
    ctx.save();
    glow(GREEN, 4);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(x - 34, cy - span / 2, 68, span);
    ctx.clip();
    ctx.globalAlpha = 0.9;
    if (band) {
      const top = cy - (band[1] - value) / perPx;
      const bot = cy - (band[0] - value) / perPx;
      ctx.fillStyle = 'rgba(125, 255, 176, 0.22)';
      ctx.fillRect(x - 34, top, 68, bot - top);
      ctx.fillStyle = GREEN;
    }
    ctx.font = MONO;
    ctx.textAlign = side === 'left' ? 'right' : 'left';
    const first = Math.floor((value - span * perPx) / step) * step;
    for (let t = first; t < value + span * perPx; t += step) {
      const y = cy - (t - value) / perPx;
      const major = Math.round(t / step) % 2 === 0;
      ctx.beginPath();
      const dir = side === 'left' ? 1 : -1;
      ctx.moveTo(x + dir * -34 + (side === 'left' ? 68 : 0) * 0, y);
      ctx.moveTo(side === 'left' ? x + 34 : x - 34, y);
      ctx.lineTo(side === 'left' ? x + (major ? 18 : 26) : x - (major ? 18 : 26), y);
      ctx.stroke();
      if (major) ctx.fillText(format(t), side === 'left' ? x + 12 : x - 12 + 0, y + 5);
    }
    ctx.restore();
    ctx.save();
    glow(GREEN, 4);
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(4, 18, 12, 0.8)';
    ctx.beginPath();
    ctx.rect(x - 34, cy - 14, 68, 28);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = GREEN;
    ctx.font = '700 17px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(format(value), x, cy + 6);
    ctx.font = '600 11px Heebo, sans-serif';
    ctx.fillText(label, x, cy - span / 2 - 8);
    ctx.restore();
  }

  function ladder(cx, cy, f, plane) {
    const pitch = THREE.MathUtils.degToRad(plane.pitch);
    const roll = THREE.MathUtils.degToRad(plane.roll);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-roll);
    glow(GREEN, 5);
    ctx.lineWidth = 1.6;
    ctx.font = '600 13px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    for (let a = -90; a <= 90; a += 5) {
      const ar = THREE.MathUtils.degToRad(a);
      const y = f * (Math.tan(pitch) - Math.tan(ar));
      if (!Number.isFinite(y) || Math.abs(y) > h * 0.7) continue;
      const major = a % 10 === 0;
      if (a === 0) {
        ctx.beginPath();
        ctx.moveTo(-w * 0.34, y);
        ctx.lineTo(-70, y);
        ctx.moveTo(70, y);
        ctx.lineTo(w * 0.34, y);
        ctx.stroke();
        continue;
      }
      if (!major) continue;
      const half = 58;
      ctx.beginPath();
      if (a > 0) {
        ctx.moveTo(-half, y + 9);
        ctx.lineTo(-half, y);
        ctx.lineTo(-18, y);
        ctx.moveTo(half, y + 9);
        ctx.lineTo(half, y);
        ctx.lineTo(18, y);
      } else {
        ctx.setLineDash([7, 6]);
        ctx.moveTo(-half, y - 9);
        ctx.lineTo(-half, y);
        ctx.lineTo(-18, y);
        ctx.moveTo(half, y - 9);
        ctx.lineTo(half, y);
        ctx.lineTo(18, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillText(String(Math.abs(a)), -half - 18, y + 4);
      ctx.fillText(String(Math.abs(a)), half + 18, y + 4);
    }
    ctx.restore();
  }

  function headingTape(plane, bug) {
    const cx = w / 2;
    const y = 34;
    const heading = plane.heading;
    ctx.save();
    glow(GREEN, 4);
    ctx.font = MONO;
    ctx.textAlign = 'center';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(cx - 170, y - 18, 340, 44);
    ctx.clip();
    for (let d = -60; d <= 60; d += 5) {
      const deg = Math.round(heading / 5) * 5 + d;
      const x = cx + (deg - heading) * 5.2;
      const norm = ((deg % 360) + 360) % 360;
      const major = norm % 10 === 0;
      ctx.beginPath();
      ctx.moveTo(x, y + 8);
      ctx.lineTo(x, y + (major ? -2 : 3));
      ctx.stroke();
      if (norm % 30 === 0) {
        const names = { 0: 'צ', 90: 'מ', 180: 'ד', 270: 'מע' };
        ctx.fillText(names[norm] ?? String(norm / 10), x, y + 22);
      }
    }
    if (bug !== null && bug !== undefined) {
      let delta = ((bug - heading + 540) % 360) - 180;
      delta = Math.max(-60, Math.min(60, delta));
      ctx.fillStyle = AMBER;
      ctx.strokeStyle = AMBER;
      ctx.beginPath();
      ctx.moveTo(cx + delta * 5.2, y + 10);
      ctx.lineTo(cx + delta * 5.2 - 6, y - 2);
      ctx.lineTo(cx + delta * 5.2 + 6, y - 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.save();
    glow(GREEN, 4);
    ctx.fillStyle = 'rgba(4, 18, 12, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(cx - 28, y - 30, 56, 22);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = GREEN;
    ctx.font = '700 16px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(heading)).padStart(3, '0'), cx, y - 13);
    ctx.restore();
  }

  function bracket(x, y, size, color, label, label2) {
    ctx.save();
    glow(color, 8);
    ctx.lineWidth = 2.5;
    const s = size;
    const l = Math.max(7, s * 0.35);
    ctx.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ctx.moveTo(x + sx * s, y + sy * (s - l));
      ctx.lineTo(x + sx * s, y + sy * s);
      ctx.lineTo(x + sx * (s - l), y + sy * s);
    }
    ctx.stroke();
    ctx.font = MONO;
    ctx.textAlign = 'center';
    if (label) ctx.fillText(label, x, y + s + 20);
    if (label2) ctx.fillText(label2, x, y + s + 38);
    ctx.restore();
  }

  function edgeArrow(x, y, color, text) {
    // Pointer at the edge of the screen toward something that isn't in view.
    const cx = w / 2;
    const cy = h / 2;
    const a = Math.atan2(y - cy, x - cx);
    const r = Math.min(w, h) * 0.42;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    ctx.save();
    glow(color, 8);
    ctx.translate(px, py);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-8, -10);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-8, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    if (text) {
      ctx.save();
      glow(color, 6);
      ctx.font = MONO;
      ctx.textAlign = 'center';
      ctx.fillText(text, px - Math.cos(a) * 34, py - Math.sin(a) * 34 + 5);
      ctx.restore();
    }
  }

  /** Mark something in the world: a box when in view, an arrow at the edge when not. */
  function mark(camera, position, { color = GREEN, size = 26, label, label2 } = {}) {
    const p = project(camera, position);
    const onScreen = !p.behind && p.x > 40 && p.x < w - 40 && p.y > 60 && p.y < h - 60;
    if (onScreen) {
      bracket(p.x, p.y, size, color, label, label2);
      return p;
    }
    const px = p.behind ? w - p.x : p.x;
    const py = p.behind ? h - p.y : p.y;
    edgeArrow(px, py, color, label);
    return p;
  }

  /**
   * frame = {
   *   plane, camera, time, enemy?: {position, range}, speedBand?, altBand?, headingBug?,
   *   marks?: [{position, color, label, label2, size}], gunsight?: {hot, radius}, throttle?,
   *   warnings: { lowAlt, stall, missile?: Vector3, flash }, message?, bombCount?
   * }
   */
  function draw(frame) {
    ctx.clearRect(0, 0, w, h);
    const { plane, camera } = frame;
    const cx = w / 2;
    const cy = h / 2;
    const f = cy / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    ctx.lineJoin = 'round';

    ladder(cx, cy, f, plane);

    // Boresight and the flight path marker.
    ctx.save();
    glow(GREEN, 6);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.moveTo(cx - 20, cy);
    ctx.lineTo(cx - 9, cy);
    ctx.moveTo(cx + 9, cy);
    ctx.lineTo(cx + 20, cy);
    ctx.moveTo(cx, cy - 9);
    ctx.lineTo(cx, cy - 18);
    ctx.stroke();
    ctx.restore();

    tape(110, 'left', plane.speed * KT, { step: 20, band: frame.speedBand, label: 'מהירות (קשר)', format: (t) => String(Math.round(t)) });
    tape(w - 110, 'right', plane.position.y, { step: 100, band: frame.altBand, label: 'גובה (מ׳)', format: (t) => String(Math.round(t)) });
    headingTape(plane, frame.headingBug);

    // Throttle and G.
    ctx.save();
    glow(GREEN, 4);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = GREEN;
    const bx = 70;
    const by = h - 150;
    ctx.strokeRect(bx, by, 14, 90);
    ctx.fillStyle = frame.throttle > 0.92 ? AMBER : GREEN;
    ctx.fillRect(bx + 2, by + 88 - 86 * frame.throttle, 10, 86 * frame.throttle);
    ctx.fillStyle = GREEN;
    ctx.font = '600 11px Heebo, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('מצערת', bx + 7, by + 108);
    ctx.font = MONO;
    ctx.textAlign = 'left';
    ctx.fillText(`G ${plane.gLoad.toFixed(1)}`, bx + 28, by + 14);
    ctx.restore();

    // The other aircraft: a bracket with range, and the gunsight.
    if (frame.enemy) {
      const e = frame.enemy;
      const size = Math.max(14, Math.min(60, 9000 / Math.max(150, e.range)));
      const p = mark(camera, e.position, { color: e.color ?? AMBER, size, label: `${Math.round(e.range)} מ׳`, label2: e.label2 });
      if (frame.gunsight) {
        const { hot, angle, radius: fixed } = frame.gunsight;
        const radius = angle ? Math.max(10, f * Math.tan(angle)) : fixed;
        ctx.save();
        glow(hot ? RED : GREEN, 8);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      void p;
    }
    for (const m of frame.marks ?? []) mark(camera, m.position, m);
    if (frame.pipper) {
      const p = project(camera, frame.pipper);
      if (!p.behind && p.x > 0 && p.x < w && p.y > 0 && p.y < h) {
        ctx.save();
        glow(AMBER, 8);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
        ctx.moveTo(p.x - 20, p.y);
        ctx.lineTo(p.x - 13, p.y);
        ctx.moveTo(p.x + 13, p.y);
        ctx.lineTo(p.x + 20, p.y);
        ctx.moveTo(p.x, p.y + 13);
        ctx.lineTo(p.x, p.y + 20);
        ctx.stroke();
        ctx.font = '700 12px Heebo, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('נקודת נפילה', p.x, p.y + 36);
        ctx.restore();
      }
    }

    // Bombs left, and the master caution lamp.
    if (frame.bombCount !== undefined) {
      ctx.save();
      glow(AMBER, 4);
      ctx.font = '700 15px Heebo, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`פצצות: ${frame.bombCount}`, 70, h - 170);
      ctx.restore();
    }
    if (frame.warnLamp && Math.floor(frame.time * 5) % 2 === 0) {
      ctx.save();
      glow(AMBER, 14);
      ctx.beginPath();
      ctx.arc(cx, h - 62, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Warnings.
    const wr = frame.warnings ?? {};
    ctx.save();
    ctx.textAlign = 'center';
    let row = 0;
    const warn = (text, color) => {
      glow(color, 12);
      ctx.font = '800 26px Heebo, sans-serif';
      if (Math.floor(frame.time * 4) % 2 === 0) ctx.fillText(text, cx, h * 0.3 + row * 34);
      row++;
    };
    if (wr.lowAlt) warn('גובה נמוך', RED);
    if (wr.stall) warn('מהירות נמוכה!', RED);
    if (wr.missile) {
      warn('טיל! התחמק', RED);
      const p = project(camera, wr.missile);
      edgeArrow(p.behind ? w - p.x : p.x, p.behind ? h - p.y : p.y, RED, '');
    }
    ctx.restore();

    if (frame.message) {
      ctx.save();
      ctx.font = '700 20px Heebo, sans-serif';
      ctx.textAlign = 'center';
      const text = frame.message.text;
      const tw = ctx.measureText(text).width + 36;
      ctx.fillStyle = 'rgba(4, 18, 12, 0.78)';
      ctx.strokeStyle = frame.message.color ?? GREEN;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(cx - tw / 2, h - 118, tw, 38, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = frame.message.color ?? GREEN;
      ctx.fillText(text, cx, h - 93);
      ctx.restore();
    }
  }

  return { resize, draw, project };
}
