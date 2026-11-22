export const WIN95_PALETTE = {
  light: '#FFFFFF',
  face: '#C0C0C0',
  dark: '#808080',
  shadow: '#000000',
  titleNavy1: '#000080',
  titleNavy2: '#1084d0',
  blueprintBg: '#1d4ed8',
  blueprintGrid: '#2563eb',
  ledActive: '#22c55e',
  ledInactive: '#15803d',
  ledGlow: 'rgba(34, 197, 94, 0.45)',
} as const;

export function drawRaisedBevel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  t = 2,
  fill?: string
): void {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
  }

  // Outer highlight (Top / Left) - White
  ctx.fillStyle = WIN95_PALETTE.light;
  ctx.fillRect(x, y, w, t);
  ctx.fillRect(x, y, t, h);

  // Outer shadow (Bottom / Right) - Black
  ctx.fillStyle = WIN95_PALETTE.shadow;
  ctx.fillRect(x, y + h - t, w, t);
  ctx.fillRect(x + w - t, y, t, h);

  if (t > 1) {
    const half = Math.floor(t / 2);
    // Inner shadow (Bottom-1 / Right-1) - Dark Gray
    ctx.fillStyle = WIN95_PALETTE.dark;
    ctx.fillRect(x + half, y + h - t, w - 2 * half, half);
    ctx.fillRect(x + w - t, y + half, half, h - 2 * half);
  }
}

export function drawSunkenBevel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  t = 2,
  fill?: string
): void {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
  }

  // Outer top/left - Dark Gray
  ctx.fillStyle = WIN95_PALETTE.dark;
  ctx.fillRect(x, y, w, t);
  ctx.fillRect(x, y, t, h);

  // Outer bottom/right - Light
  ctx.fillStyle = WIN95_PALETTE.light;
  ctx.fillRect(x, y + h - t, w, t);
  ctx.fillRect(x + w - t, y, t, h);

  if (t > 1) {
    const half = Math.floor(t / 2);
    // Inner top/left - Black
    ctx.fillStyle = WIN95_PALETTE.shadow;
    ctx.fillRect(x + half, y + half, w - 2 * half, half);
    ctx.fillRect(x + half, y + half, half, h - 2 * half);
  }
}

export function drawEtchedLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y: number,
  x2: number,
  t = 1
): void {
  const w = x2 - x1;
  ctx.fillStyle = WIN95_PALETTE.dark;
  ctx.fillRect(x1, y, w, t);
  ctx.fillStyle = WIN95_PALETTE.light;
  ctx.fillRect(x1, y + t, w, t);
}

export function drawLedIndicator(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size = 12,
  active = true
): void {
  const radius = size / 2;
  const cx = x + radius;
  const cy = y + radius;

  // Sunken socket outer bevel
  drawSunkenBevel(ctx, x - 2, y - 2, size + 4, size + 4, 1, '#1e293b');

  // Bulb
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = active ? WIN95_PALETTE.ledActive : WIN95_PALETTE.ledInactive;
  ctx.fill();

  if (active) {
    // Glow effect
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 2.2, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(cx, cy, radius * 0.5, cx, cy, radius * 2.2);
    grad.addColorStop(0, 'rgba(34, 197, 94, 0.6)');
    grad.addColorStop(1, 'rgba(34, 197, 94, 0)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Hotspot reflection
    ctx.beginPath();
    ctx.arc(cx - radius * 0.3, cy - radius * 0.3, radius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fill();
  }
}

export function drawWindowButtons(
  ctx: CanvasRenderingContext2D,
  rightX: number,
  y: number,
  btnW = 16,
  btnH = 14,
  gap = 2
): void {
  const totalW = 3 * btnW + 2 * gap;
  const startX = rightX - totalW;

  // 3 Buttons: Minimize (_), Maximize ([]), Close (X)
  const symbols = ['_', '[]', 'X'];

  for (let i = 0; i < 3; i++) {
    const bx = startX + i * (btnW + gap);
    const bevelT = Math.max(1, Math.round(btnH * 0.1));
    drawRaisedBevel(ctx, bx, y, btnW, btnH, bevelT, WIN95_PALETTE.face);

    ctx.fillStyle = WIN95_PALETTE.shadow;
    const cx = bx + btnW / 2;
    const cy = y + btnH / 2;
    const glyphScale = btnW / 18;

    if (symbols[i] === '_') {
      const gw = Math.round(6 * glyphScale);
      const gh = Math.max(1, Math.round(2 * glyphScale));
      const gy = cy + Math.round(2 * glyphScale);
      ctx.fillRect(cx - gw / 2, gy, gw, gh);
    } else if (symbols[i] === '[]') {
      const gw = Math.round(7 * glyphScale);
      const gh = Math.round(7 * glyphScale);
      const lw = Math.max(1, Math.round(1 * glyphScale));
      ctx.lineWidth = lw;
      ctx.strokeRect(cx - gw / 2, cy - gh / 2, gw, gh);
      ctx.fillRect(cx - gw / 2, cy - gh / 2, gw, Math.max(1, Math.round(2 * glyphScale)));
    } else {
      // 'X'
      const s = Math.round(3.5 * glyphScale);
      ctx.lineWidth = Math.max(1, Math.round(1.5 * glyphScale));
      ctx.beginPath();
      ctx.moveTo(cx - s, cy - s);
      ctx.lineTo(cx + s, cy + s);
      ctx.moveTo(cx + s, cy - s);
      ctx.lineTo(cx - s, cy + s);
      ctx.strokeStyle = WIN95_PALETTE.shadow;
      ctx.stroke();
    }
  }
}

export function drawPixelCursor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1
): void {
  // Classic 11x16 pixel arrow cursor bitmap
  const cursorMap = [
    'X              ',
    'XX             ',
    'X.X            ',
    'X..X           ',
    'X...X          ',
    'X....X         ',
    'X.....X        ',
    'X......X       ',
    'X.......X      ',
    'X........X     ',
    'X.....XXXXX    ',
    'X..X..X        ',
    'X.X X..X       ',
    'XX   X..X      ',
    'X     X..X     ',
    '       XX      ',
  ];

  ctx.save();
  for (let r = 0; r < cursorMap.length; r++) {
    const row = cursorMap[r];
    for (let c = 0; c < row.length; c++) {
      const char = row[c];
      if (char === 'X') {
        ctx.fillStyle = WIN95_PALETTE.shadow;
        ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
      } else if (char === '.') {
        ctx.fillStyle = WIN95_PALETTE.light;
        ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
      }
    }
  }
  ctx.restore();
}
