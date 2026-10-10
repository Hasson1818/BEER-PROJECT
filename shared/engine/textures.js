import * as THREE from 'three';

export const FONT = 'Heebo, Arial, sans-serif';

export function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function redraw(texture, draw) {
  const canvas = texture.image;
  draw(canvas.getContext('2d'), canvas.width, canvas.height);
  texture.needsUpdate = true;
}

function hebrewText(ctx, text, x, y, size, weight = 700, color = '#ffffff', align = 'center') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';
  ctx.fillText(text, x, y);
}

/**
 * A flat sign. `lines` is one string or [title, subtitle].
 * Returns a plane mesh facing +z, `width` meters wide.
 */
export function makeSign(lines, { width = 2, height = 0.5, bg = '#2f3a20', fg = '#f1e8cf', accent = null } = {}) {
  const [title, subtitle] = Array.isArray(lines) ? lines : [lines];
  const px = 256;
  const texture = canvasTexture(Math.round(width * px), Math.round(height * px), (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    if (accent) {
      ctx.fillStyle = accent;
      ctx.fillRect(w - 18, 0, 18, h);
    }
    if (subtitle) {
      hebrewText(ctx, title, w / 2, h * 0.38, h * 0.4, 700, fg);
      hebrewText(ctx, subtitle, w / 2, h * 0.76, h * 0.22, 500, fg);
    } else {
      hebrewText(ctx, title, w / 2, h * 0.53, h * 0.55, 700, fg);
    }
  });
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.7 }),
  );
  return mesh;
}

/** A poster with a colored header and a few lines of text. */
export function makePoster(title, lines, { width = 0.9, height = 1.2, color = '#4b5320' } = {}) {
  const px = 360;
  const texture = canvasTexture(Math.round(width * px), Math.round(height * px), (ctx, w, h) => {
    ctx.fillStyle = '#f6f1e3';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h * 0.26);
    hebrewText(ctx, title, w / 2, h * 0.13, h * 0.08, 800, '#ffffff');
    lines.forEach((line, i) => {
      hebrewText(ctx, line, w - w * 0.08, h * (0.36 + i * 0.1), h * 0.045, 500, '#2a2d1d', 'right');
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);
  });
  return new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8 }),
  );
}

export function tileTexture(base = '#d9d6cf', line = '#bdb8ae', repeatX = 1, repeatY = 1) {
  const texture = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    // Light speckle so the floor isn't flat.
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.05})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    ctx.strokeStyle = line;
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, w, h);
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  return texture;
}

/** Off-white wall with a darker band at the bottom (walls are 3.2 m tall). */
export function wallTexture() {
  return canvasTexture(64, 320, (ctx, w, h) => {
    ctx.fillStyle = '#ece8de';
    ctx.fillRect(0, 0, w, h);
    const band = h * (1.1 / 3.2);
    ctx.fillStyle = '#a9ae98';
    ctx.fillRect(0, h - band, w, band);
    ctx.fillStyle = '#6f745f';
    ctx.fillRect(0, h - band - 4, w, 4);
  });
}

/** Barcode sticker graphic, also used in the HUD. */
export function drawBarcode(ctx, x, y, w, h, seed = 7) {
  let s = seed;
  const next = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  ctx.fillStyle = '#111111';
  let cx = x;
  while (cx < x + w) {
    const bar = 1 + Math.floor(next() * 3);
    if (next() > 0.4) ctx.fillRect(cx, y, bar, h);
    cx += bar + 1;
  }
}

/** Screen in the waiting hall: called numbers and numbers still waiting. */
export function drawQueueScreen(ctx, w, h, { called, waiting, highlight }) {
  ctx.fillStyle = '#0d1b2a';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1b3a5c';
  ctx.fillRect(0, 0, w, 86);
  hebrewText(ctx, 'לשכת גיוס · מספרים שנקראו', w - 30, 44, 40, 800, '#ffffff', 'right');

  const colNumber = w - 40;
  const colStation = w - 260;
  hebrewText(ctx, 'מספר', colNumber, 120, 26, 700, '#8fb3d9', 'right');
  hebrewText(ctx, 'תחנה', colStation, 120, 26, 700, '#8fb3d9', 'right');

  called.slice(0, 5).forEach((entry, i) => {
    const rowY = 175 + i * 64;
    const isMine = entry.number === highlight;
    if (isMine) {
      ctx.fillStyle = '#f2c94c';
      ctx.fillRect(20, rowY - 30, w - 40, 60);
    } else if (i % 2 === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(20, rowY - 30, w - 40, 60);
    }
    const color = isMine ? '#111111' : '#ffffff';
    ctx.direction = 'ltr';
    ctx.font = `800 38px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(entry.number, colNumber, rowY);
    hebrewText(ctx, entry.station, colStation, rowY, 32, 600, color, 'right');
  });

  ctx.fillStyle = '#132a44';
  ctx.fillRect(0, h - 70, w, 70);
  hebrewText(ctx, 'ממתינים:', w - 30, h - 35, 26, 700, '#8fb3d9', 'right');
  ctx.direction = 'ltr';
  ctx.font = `700 28px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'right';
  ctx.fillText(waiting.join('   '), w - 170, h - 34);
}
