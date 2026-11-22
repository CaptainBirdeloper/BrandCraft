import { CardSpec, CARD_BASE_W, CARD_BASE_H } from './types';

/**
 * Seeded pseudo-random number generator (mulberry32)
 * Deterministic: identical seed produces identical card layout.
 */
export function prng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type ArchetypeId =
  | 'asymmetric-split'
  | 'editorial-cover'
  | 'swiss-matrix'
  | 'trading-inset'
  | 'minimalist-poster';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CardPalette {
  bg: string;
  surface: string;
  accent: string;
  text: string;
  subtext: string;
  rule: string;
}

export interface CardRecipe {
  archetype: ArchetypeId;
  seed: number;
  palette: CardPalette;
  spec: CardSpec;
  pfpBox: Box;
  pfpRadius: number;
  pfpBorder: boolean;
  nameBox: { x: number; y: number; size: number; align: CanvasTextAlign; format: 'bracket' | 'plain' | 'slash' | 'pill' };
  quoteBox: { x: number; y: number; size: number; maxWidth: number; maxLines: number };
  accents: Array<{
    type: 'gradient-bar' | 'barcode' | 'crosshair' | 'stripe' | 'tag' | 'frame';
    box: Box;
    color: string;
    extra?: string;
  }>;
}

const PALETTES: CardPalette[] = [
  // 1. BrandCraft Hero Vermilion
  { bg: '#D41414', surface: '#090446', accent: '#FFFF00', text: '#FFFF00', subtext: '#FFFFFF', rule: 'rgba(255,255,255,0.3)' },
  // 2. Midnight Gold & Navy
  { bg: '#090446', surface: '#000000', accent: '#FFFF00', text: '#FFFF00', subtext: 'rgba(255,255,255,0.85)', rule: 'rgba(255,255,0,0.3)' },
  // 3. Swiss Modern Cream
  { bg: '#F4EFE6', surface: '#090446', accent: '#D41414', text: '#090446', subtext: '#D41414', rule: 'rgba(9,4,70,0.2)' },
  // 4. Obsidian Noir
  { bg: '#08080C', surface: '#121218', accent: '#FFFF00', text: '#FFFF00', subtext: 'rgba(255,255,255,0.85)', rule: 'rgba(255,255,255,0.2)' },
  // 5. Cobalt & Amber
  { bg: '#0B2545', surface: '#13315C', accent: '#FFB703', text: '#FFB703', subtext: '#EEF4F8', rule: 'rgba(255,183,3,0.3)' },
  // 6. Forest Emerald & Acid
  { bg: '#0A2218', surface: '#04120C', accent: '#00FF88', text: '#00FF88', subtext: '#E0F2E9', rule: 'rgba(0,255,136,0.3)' },
  // 7. Cyberpunk Acid Monolith
  { bg: '#10002B', surface: '#240046', accent: '#E0AAFF', text: '#E0AAFF', subtext: '#FFFFFF', rule: 'rgba(224,170,255,0.25)' },
  // 8. Bauhaus Steel
  { bg: '#212529', surface: '#343A40', accent: '#E63946', text: '#F8F9FA', subtext: '#E63946', rule: 'rgba(248,249,250,0.2)' },
];

/**
 * Procedural recipe compiler: translates seed and user spec into a layout AST.
 */
export function generateCardRecipe(seed: number, spec: CardSpec): CardRecipe {
  const rand = prng(seed);
  const archetypeIndex = Math.floor(rand() * 5);
  const archetypes: ArchetypeId[] = [
    'asymmetric-split',
    'editorial-cover',
    'swiss-matrix',
    'trading-inset',
    'minimalist-poster',
  ];
  const archetype = archetypes[archetypeIndex];

  // Pick or harmonize palette
  const basePalette = PALETTES[Math.floor(rand() * PALETTES.length)];
  const palette: CardPalette = {
    ...basePalette,
    text: spec.textColor || basePalette.text,
    accent: spec.textColor || basePalette.accent,
  };

  const W = CARD_BASE_W;
  const H = CARD_BASE_H;

  switch (archetype) {
    case 'asymmetric-split': {
      const isLeft = rand() < 0.5;
      const pfpSize = 440;
      const pad = 24;
      const pfpX = isLeft ? pad : W - pfpSize - pad;
      const pfpY = pad;
      const gradX = isLeft ? pfpX + pfpSize + 20 : pad;
      const gradW = W - pfpSize - pad * 2 - 20;

      return {
        archetype,
        seed,
        palette,
        spec,
        pfpBox: { x: pfpX, y: pfpY, w: pfpSize, h: pfpSize },
        pfpRadius: 0,
        pfpBorder: false,
        nameBox: {
          x: isLeft ? pad : pad,
          y: pfpY + pfpSize + 68,
          size: 60,
          align: 'left',
          format: 'bracket',
        },
        quoteBox: {
          x: pad,
          y: pfpY + pfpSize + 128,
          size: 42,
          maxWidth: W - pad * 2,
          maxLines: 4,
        },
        accents: [
          {
            type: 'gradient-bar',
            box: { x: gradX, y: pfpY, w: gradW, h: pfpSize },
            color: palette.accent,
          },
          {
            type: 'tag',
            box: { x: pad, y: H - 36, w: 200, h: 20 },
            color: palette.subtext,
            extra: `BC // ${seed.toString(16).toUpperCase().slice(-6)}`,
          },
        ],
      };
    }

    case 'editorial-cover': {
      const pad = 36;
      const pfpY = 110;
      const pfpW = W - pad * 2;
      const pfpH = 500;

      return {
        archetype,
        seed,
        palette,
        spec,
        pfpBox: { x: pad, y: pfpY, w: pfpW, h: pfpH },
        pfpRadius: 0,
        pfpBorder: false,
        nameBox: {
          x: pad,
          y: 74,
          size: 54,
          align: 'left',
          format: 'plain',
        },
        quoteBox: {
          x: pad,
          y: pfpY + pfpH + 68,
          size: 40,
          maxWidth: W - pad * 2,
          maxLines: 3,
        },
        accents: [
          {
            type: 'stripe',
            box: { x: pad, y: H - pad - 12, w: W - pad * 2, h: 2 },
            color: palette.rule,
          },
          {
            type: 'tag',
            box: { x: W - pad - 120, y: 70, w: 120, h: 20 },
            color: palette.text,
            extra: 'ISSUE NO. 01',
          },
          {
            type: 'barcode',
            box: { x: pad, y: H - pad - 44, w: 140, h: 24 },
            color: palette.subtext,
          },
        ],
      };
    }

    case 'swiss-matrix': {
      const pad = 32;
      const stripeW = 32;
      const pfpX = pad + stripeW + 20;
      const pfpY = pad;
      const pfpW = W - pfpX - pad;
      const pfpH = 520;

      return {
        archetype,
        seed,
        palette,
        spec,
        pfpBox: { x: pfpX, y: pfpY, w: pfpW, h: pfpH },
        pfpRadius: 0,
        pfpBorder: false,
        nameBox: {
          x: pfpX,
          y: pfpY + pfpH + 64,
          size: 54,
          align: 'left',
          format: 'slash',
        },
        quoteBox: {
          x: pfpX,
          y: pfpY + pfpH + 120,
          size: 38,
          maxWidth: pfpW,
          maxLines: 4,
        },
        accents: [
          {
            type: 'stripe',
            box: { x: pad, y: pad, w: stripeW, h: H - pad * 2 },
            color: palette.accent,
          },
          {
            type: 'crosshair',
            box: { x: pfpX + pfpW - 32, y: pfpY + 24, w: 24, h: 24 },
            color: '#FFFFFF',
          },
        ],
      };
    }

    case 'trading-inset': {
      const outerPad = 28;
      const innerW = W - outerPad * 2;
      const innerH = H - outerPad * 2;
      const pfpPad = 24;
      const pfpSize = innerW - pfpPad * 2;
      const pfpX = outerPad + pfpPad;
      const pfpY = outerPad + pfpPad + 60;

      return {
        archetype,
        seed,
        palette,
        spec,
        pfpBox: { x: pfpX, y: pfpY, w: pfpSize, h: pfpSize },
        pfpRadius: 16,
        pfpBorder: false,
        nameBox: {
          x: W / 2,
          y: outerPad + 48,
          size: 46,
          align: 'center',
          format: 'pill',
        },
        quoteBox: {
          x: W / 2,
          y: pfpY + pfpSize + 64,
          size: 36,
          maxWidth: innerW - 40,
          maxLines: 4,
        },
        accents: [
          {
            type: 'frame',
            box: { x: outerPad, y: outerPad, w: innerW, h: innerH },
            color: palette.accent,
          },
          {
            type: 'tag',
            box: { x: W / 2 - 80, y: H - outerPad - 24, w: 160, h: 20 },
            color: palette.accent,
            extra: 'COLLECTOR EDITION',
          },
        ],
      };
    }

    case 'minimalist-poster':
    default: {
      const pad = 36;
      const pfpSize = W - pad * 2;
      const pfpX = pad;
      const pfpY = pad;

      return {
        archetype,
        seed,
        palette,
        spec,
        pfpBox: { x: pfpX, y: pfpY, w: pfpSize, h: pfpSize },
        pfpRadius: 0,
        pfpBorder: false,
        nameBox: {
          x: W / 2,
          y: pfpY + pfpSize + 70,
          size: 56,
          align: 'center',
          format: 'plain',
        },
        quoteBox: {
          x: W / 2,
          y: pfpY + pfpSize + 128,
          size: 38,
          maxWidth: W - pad * 2,
          maxLines: 3,
        },
        accents: [
          {
            type: 'barcode',
            box: { x: W / 2 - 70, y: H - 48, w: 140, h: 24 },
            color: palette.subtext,
          },
        ],
      };
    }
  }
}

/**
 * Text wrapper with automatic line measurement & ellipsis clamp.
 */
function drawWrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
  align: CanvasTextAlign,
): void {
  const words = text.split(/\s+/);
  let line = '';
  let y = startY;
  let count = 1;

  ctx.textAlign = align;
  for (let i = 0; i < words.length; i++) {
    const testLine = line ? `${line} ${words[i]}` : words[i];
    const testW = ctx.measureText(testLine).width;
    if (testW > maxWidth && line) {
      if (count >= maxLines) {
        let trimmed = line;
        while (trimmed.length > 0 && ctx.measureText(`${trimmed}...`).width > maxWidth) {
          trimmed = trimmed.slice(0, -1).trim();
        }
        ctx.fillText(`${trimmed}...`, x, y);
        return;
      }
      ctx.fillText(line, x, y);
      line = words[i];
      y += lineHeight;
      count++;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, y);
  }
}

/**
 * Renders procedural card recipe directly onto target 2D canvas.
 */
export function renderCardRecipe(
  recipe: CardRecipe,
  bustImg: HTMLImageElement | HTMLCanvasElement,
  targetCanvas?: HTMLCanvasElement,
  targetWidth = CARD_BASE_W,
  targetHeight = CARD_BASE_H,
): HTMLCanvasElement {
  const canvas = targetCanvas || document.createElement('canvas');
  if (canvas.width !== targetWidth) canvas.width = targetWidth;
  if (canvas.height !== targetHeight) canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');

  const s = targetWidth / CARD_BASE_W;
  const p = recipe.palette;

  // 1. Background fill
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  // 2. Render Graphic Accents
  for (const acc of recipe.accents) {
    const bx = Math.round(acc.box.x * s);
    const by = Math.round(acc.box.y * s);
    const bw = Math.round(acc.box.w * s);
    const bh = Math.round(acc.box.h * s);

    if (acc.type === 'gradient-bar') {
      const grad = ctx.createLinearGradient(bx, by, bx, by + bh);
      grad.addColorStop(0, '#FF4500');
      grad.addColorStop(0.5, '#FF8C00');
      grad.addColorStop(1, '#FFD700');
      ctx.fillStyle = grad;
      ctx.fillRect(bx, by, bw, bh);
    } else if (acc.type === 'stripe') {
      ctx.fillStyle = acc.color;
      ctx.fillRect(bx, by, bw, bh);
    } else if (acc.type === 'frame') {
      ctx.strokeStyle = acc.color;
      ctx.lineWidth = Math.max(1, Math.round(2 * s));
      ctx.strokeRect(bx, by, bw, bh);
    } else if (acc.type === 'tag') {
      ctx.fillStyle = acc.color;
      ctx.font = `600 ${Math.round(13 * s)}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(acc.extra || '', bx, by + bh);
    } else if (acc.type === 'barcode') {
      ctx.fillStyle = acc.color;
      const barCount = 18;
      const step = bw / barCount;
      const rand = prng(recipe.seed + 99);
      for (let b = 0; b < barCount; b++) {
        if (rand() > 0.3) {
          ctx.fillRect(bx + b * step, by, Math.max(1, Math.round(step * 0.55)), bh);
        }
      }
    } else if (acc.type === 'crosshair') {
      ctx.strokeStyle = acc.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bx, by + bh / 2);
      ctx.lineTo(bx + bw, by + bh / 2);
      ctx.moveTo(bx + bw / 2, by);
      ctx.lineTo(bx + bw / 2, by + bh);
      ctx.stroke();
    }
  }

  // 3. Render PFP Character Window (Always borderless per user mandate)
  const px = Math.round(recipe.pfpBox.x * s);
  const py = Math.round(recipe.pfpBox.y * s);
  const pw = Math.round(recipe.pfpBox.w * s);
  const ph = Math.round(recipe.pfpBox.h * s);

  ctx.fillStyle = p.surface;
  if (recipe.pfpRadius > 0 && typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, recipe.pfpRadius * s);
    ctx.fill();
  } else {
    ctx.fillRect(px, py, pw, ph);
  }

  if (bustImg) {
    const imgW = (bustImg as HTMLImageElement).naturalWidth || bustImg.width || 1;
    const imgH = (bustImg as HTMLImageElement).naturalHeight || bustImg.height || 1;
    const scale = Math.max(pw / imgW, ph / imgH);
    const dw = imgW * scale;
    const dh = imgH * scale;

    ctx.save();
    ctx.beginPath();
    if (recipe.pfpRadius > 0 && typeof ctx.roundRect === 'function') {
      ctx.roundRect(px, py, pw, ph, recipe.pfpRadius * s);
    } else {
      ctx.rect(px, py, pw, ph);
    }
    ctx.clip();
    ctx.drawImage(bustImg, px + (pw - dw) / 2, py + (ph - dh) / 2, dw, dh);
    ctx.restore();
  }

  // 4. Render Typography (Username)
  const nb = recipe.nameBox;
  const nx = Math.round(nb.x * s);
  const ny = Math.round(nb.y * s);
  const nSize = Math.round(nb.size * s);

  ctx.fillStyle = p.text;
  ctx.font = `italic 700 ${nSize}px "serif", Georgia, "Times New Roman"`;
  ctx.textAlign = nb.align;
  ctx.textBaseline = 'alphabetic';

  let rawName = nb.format === 'bracket' ? `[ ${(recipe.spec.username || 'BUILDER').toUpperCase()} ]` :
    nb.format === 'slash' ? `// ${(recipe.spec.username || 'BUILDER').toUpperCase()}` :
    (recipe.spec.username || 'BUILDER').toUpperCase();

  ctx.fillText(rawName, nx, ny);

  // 5. Render Typography (Quote)
  const qb = recipe.quoteBox;
  const qx = Math.round(qb.x * s);
  const qy = Math.round(qb.y * s);
  const qSize = Math.round(qb.size * s);
  const qMaxW = Math.round(qb.maxWidth * s);

  ctx.fillStyle = p.subtext;
  ctx.font = `italic 400 ${qSize}px "serif", Georgia, "Times New Roman"`;
  const rawQuote = (recipe.spec.quote || 'built with stone and fire').trim();
  const quoteText = rawQuote.startsWith('"') ? rawQuote : `"${rawQuote}"`;
  drawWrapped(ctx, quoteText, qx, qy, qMaxW, Math.round(qSize * 1.25), qb.maxLines, nb.align);

  return canvas;
}
