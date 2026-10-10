// Draws the Israeli flag on a 2D canvas, using the official proportions (220 x 160).
export function drawIsraeliFlag(ctx, w, h) {
  const u = h / 160;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#0038b8';
  ctx.fillRect(0, 15 * u, w, 25 * u);
  ctx.fillRect(0, h - 40 * u, w, 25 * u);

  ctx.strokeStyle = '#0038b8';
  ctx.lineWidth = 5.5 * u;
  ctx.lineJoin = 'miter';
  const cx = w / 2;
  const cy = h / 2;
  const radius = 22 * u;
  for (const rotation of [-Math.PI / 2, Math.PI / 2]) {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const angle = rotation + (i * 2 * Math.PI) / 3;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
}
