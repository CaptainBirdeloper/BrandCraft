import {
  CardSpec,
  ComposeCardOptions,
  CARD_BASE_W,
  CARD_BASE_H,
  DEFAULT_CARD_SPEC,
} from './types';

/**
 * Word wrap text across multiple lines within maxWidth.
 * Truncates with ellipsis if maxLines is reached.
 */
function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number = 4,
): void {
  const words = text.split(/\s+/);
  let line = '';
  let y = startY;
  let linesDrawn = 1;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = line ? `${line} ${word}` : word;
    const testWidth = ctx.measureText(testLine).width;

    if (testWidth > maxWidth && line) {
      if (linesDrawn >= maxLines) {
        let tr = line;
        while (tr.length > 0 && ctx.measureText(`${tr}...`).width > maxWidth) {
          tr = tr.slice(0, -1).trim();
        }
        ctx.fillText(`${tr}...`, x, y);
        return;
      }
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
      linesDrawn++;
    } else {
      line = testLine;
    }
  }

  if (line) {
    ctx.fillText(line, x, y);
  }
}

/**
 * 1. Poster Split - Exact 1:1 match to user's reference design
 * Bold red field, top-left framed PFP, top-right gradient panel,
 * bold yellow italic serif [ USERNAME ] and "quote".
 */
export function composePosterSplit(
  options: ComposeCardOptions,
  targetCanvas?: HTMLCanvasElement,
): HTMLCanvasElement {
  const spec: CardSpec = { ...DEFAULT_CARD_SPEC, ...options.spec };
  const targetW = options.targetWidth || CARD_BASE_W;
  const targetH = options.targetHeight || CARD_BASE_H;
  const s = targetW / CARD_BASE_W;

  const canvas = targetCanvas || document.createElement('canvas');
  if (canvas.width !== targetW) canvas.width = targetW;
  if (canvas.height !== targetH) canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.textBaseline = 'alphabetic';

  // Background: Bold vivid red
  ctx.fillStyle = '#D41414';
  ctx.fillRect(0, 0, targetW, targetH);

  const padX = Math.round(24 * s);
  const padY = Math.round(24 * s);

  // Top-Left: PFP Window
  const pfpSize = Math.round(440 * s);
  const pfpX = padX;
  const pfpY = padY;

  ctx.fillStyle = '#090446';
  ctx.fillRect(pfpX, pfpY, pfpSize, pfpSize);

  if (options.presetImage) {
    const img = options.presetImage;
    const imgW = (img as HTMLImageElement).naturalWidth || img.width || 1;
    const imgH = (img as HTMLImageElement).naturalHeight || img.height || 1;
    const scale = Math.max(pfpSize / imgW, pfpSize / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;

    ctx.save();
    ctx.beginPath();
    ctx.rect(pfpX, pfpY, pfpSize, pfpSize);
    ctx.clip();
    ctx.drawImage(img, pfpX + (pfpSize - drawW) / 2, pfpY + (pfpSize - drawH) / 2, drawW, drawH);
    ctx.restore();
  }

  // Top-Right: Vertical Warm Gradient Panel
  const gradX = pfpX + pfpSize + Math.round(20 * s);
  const gradW = targetW - gradX - padX;
  const gradH = Math.round(440 * s);

  const grad = ctx.createLinearGradient(gradX, pfpY, gradX, pfpY + gradH);
  grad.addColorStop(0, '#FF4500'); // Fiery orange-red
  grad.addColorStop(0.5, '#FF8C00'); // Deep amber
  grad.addColorStop(1, '#FFD700'); // Bright gold
  ctx.fillStyle = grad;
  ctx.fillRect(gradX, pfpY, gradW, gradH);

  // Typography below PFP
  const textX = padX;
  const nameY = pfpY + pfpSize + Math.round(68 * s);
  const textColor = spec.textColor || '#FFFF00';

  // USERNAME in giant, bold, italic serif
  ctx.fillStyle = textColor;
  ctx.font = `italic 700 ${Math.round(62 * s)}px "serif", Georgia, "Times New Roman"`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const uname = (spec.username || 'USERNAME').toUpperCase();
  ctx.fillText(uname, textX, nameY);

  // Quote with word wrap (no surrounding quotes)
  const quoteY = nameY + Math.round(58 * s);
  const quoteSize = Math.round(44 * s);
  ctx.font = `italic 400 ${quoteSize}px "serif", Georgia, "Times New Roman"`;
  ctx.fillStyle = textColor;
  const quoteText = spec.quote || 'built with stone and fire';
  const maxWidth = targetW - textX - padX;
  drawWrappedText(ctx, quoteText, textX, quoteY, maxWidth, Math.round(quoteSize * 1.25), 4);

  return canvas;
}

/**
 * 2. Editorial Cover
 * Deep navy background, top username bracket header, large framed PFP, quote below.
 */
export function composeEditorialCover(
  options: ComposeCardOptions,
  targetCanvas?: HTMLCanvasElement,
): HTMLCanvasElement {
  const spec: CardSpec = { ...DEFAULT_CARD_SPEC, ...options.spec };
  const targetW = options.targetWidth || CARD_BASE_W;
  const targetH = options.targetHeight || CARD_BASE_H;
  const s = targetW / CARD_BASE_W;

  const canvas = targetCanvas || document.createElement('canvas');
  if (canvas.width !== targetW) canvas.width = targetW;
  if (canvas.height !== targetH) canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.textBaseline = 'alphabetic';

  // Background: BrandCraft Midnight Navy
  ctx.fillStyle = '#090446';
  ctx.fillRect(0, 0, targetW, targetH);

  const padX = Math.round(36 * s);
  const padY = Math.round(36 * s);

  const textColor = spec.textColor || '#FFFF00';

  // Top Title: USERNAME
  const nameY = padY + Math.round(52 * s);
  ctx.fillStyle = textColor;
  ctx.font = `italic 700 ${Math.round(54 * s)}px "serif", Georgia, serif`;
  ctx.textAlign = 'left';
  const uname = (spec.username || 'USERNAME').toUpperCase();
  ctx.fillText(uname, padX, nameY);

  // PFP Window
  const pfpY = nameY + Math.round(24 * s);
  const pfpW = targetW - padX * 2;
  const pfpH = Math.round(520 * s);

  ctx.fillStyle = '#000000';
  ctx.fillRect(padX, pfpY, pfpW, pfpH);

  if (options.presetImage) {
    const img = options.presetImage;
    const imgW = (img as HTMLImageElement).naturalWidth || img.width || 1;
    const imgH = (img as HTMLImageElement).naturalHeight || img.height || 1;
    const scale = Math.max(pfpW / imgW, pfpH / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;

    ctx.save();
    ctx.beginPath();
    ctx.rect(padX, pfpY, pfpW, pfpH);
    ctx.clip();
    ctx.drawImage(img, padX + (pfpW - drawW) / 2, pfpY + (pfpH - drawH) / 2, drawW, drawH);
    ctx.restore();
  }

  // Quote below window with word wrap (no surrounding quotes)
  const quoteY = pfpY + pfpH + Math.round(64 * s);
  const quoteSize = Math.round(40 * s);
  ctx.font = `italic 400 ${quoteSize}px "serif", Georgia, serif`;
  ctx.fillStyle = textColor;
  const maxWidth = targetW - padX * 2;
  drawWrappedText(ctx, spec.quote || 'the architect', padX, quoteY, maxWidth, Math.round(quoteSize * 1.25), 4);

  // Subtle bottom accent rule
  const ruleY = targetH - padY - Math.round(12 * s);
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = textColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, ruleY);
  ctx.lineTo(targetW - padX, ruleY);
  ctx.stroke();
  ctx.restore();

  return canvas;
}

/**
 * 3. Swiss Modern Asymmetric
 * Warm cream background, deep obsidian & signal yellow typography.
 */
export function composeSwissModern(
  options: ComposeCardOptions,
  targetCanvas?: HTMLCanvasElement,
): HTMLCanvasElement {
  const spec: CardSpec = { ...DEFAULT_CARD_SPEC, ...options.spec };
  const targetW = options.targetWidth || CARD_BASE_W;
  const targetH = options.targetHeight || CARD_BASE_H;
  const s = targetW / CARD_BASE_W;

  const canvas = targetCanvas || document.createElement('canvas');
  if (canvas.width !== targetW) canvas.width = targetW;
  if (canvas.height !== targetH) canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.textBaseline = 'alphabetic';

  // Background: Unbleached cream
  ctx.fillStyle = '#F4EFE6';
  ctx.fillRect(0, 0, targetW, targetH);

  const pad = Math.round(32 * s);

  // Left vertical Signal Yellow stripe
  const stripeW = Math.round(36 * s);
  ctx.fillStyle = '#FFFF00';
  ctx.fillRect(pad, pad, stripeW, targetH - pad * 2);

  // PFP Window
  const pfpX = pad + stripeW + Math.round(24 * s);
  const pfpY = pad;
  const pfpW = targetW - pfpX - pad;
  const pfpH = Math.round(520 * s);

  ctx.fillStyle = '#090446';
  ctx.fillRect(pfpX, pfpY, pfpW, pfpH);

  if (options.presetImage) {
    const img = options.presetImage;
    const imgW = (img as HTMLImageElement).naturalWidth || img.width || 1;
    const imgH = (img as HTMLImageElement).naturalHeight || img.height || 1;
    const scale = Math.max(pfpW / imgW, pfpH / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;

    ctx.save();
    ctx.beginPath();
    ctx.rect(pfpX, pfpY, pfpW, pfpH);
    ctx.clip();
    ctx.drawImage(img, pfpX + (pfpW - drawW) / 2, pfpY + (pfpH - drawH) / 2, drawW, drawH);
    ctx.restore();
  }

  // Name & Quote (no brackets, no quotes, with word wrap)
  const textColor = spec.textColor && spec.textColor !== '#FFFF00' ? spec.textColor : '#090446';
  const nameY = pfpY + pfpH + Math.round(64 * s);
  ctx.fillStyle = textColor;
  ctx.font = `italic 700 ${Math.round(56 * s)}px "serif", Georgia, serif`;
  ctx.textAlign = 'left';
  const uname = (spec.username || 'USERNAME').toUpperCase();
  ctx.fillText(uname, pfpX, nameY);

  const quoteY = nameY + Math.round(54 * s);
  ctx.fillStyle = spec.textColor && spec.textColor !== '#FFFF00' ? spec.textColor : '#D41414';
  const quoteSize = Math.round(38 * s);
  ctx.font = `italic 400 ${quoteSize}px "serif", Georgia, serif`;
  const maxWidth = targetW - pfpX - pad;
  drawWrappedText(ctx, spec.quote || 'crafted in code', pfpX, quoteY, maxWidth, Math.round(quoteSize * 1.25), 4);

  return canvas;
}

/**
 * 4. Obsidian Noir
 * Deep black canvas, centered character, glowing gold frame and typography.
 */
export function composeObsidianNoir(
  options: ComposeCardOptions,
  targetCanvas?: HTMLCanvasElement,
): HTMLCanvasElement {
  const spec: CardSpec = { ...DEFAULT_CARD_SPEC, ...options.spec };
  const targetW = options.targetWidth || CARD_BASE_W;
  const targetH = options.targetHeight || CARD_BASE_H;
  const s = targetW / CARD_BASE_W;

  const canvas = targetCanvas || document.createElement('canvas');
  if (canvas.width !== targetW) canvas.width = targetW;
  if (canvas.height !== targetH) canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.textBaseline = 'alphabetic';

  // Background: Pure Noir Black
  ctx.fillStyle = '#08080C';
  ctx.fillRect(0, 0, targetW, targetH);

  const pad = Math.round(36 * s);

  // Framed PFP Window
  const pfpSize = targetW - pad * 2;
  const pfpX = pad;
  const pfpY = pad;

  ctx.fillStyle = '#000000';
  ctx.fillRect(pfpX, pfpY, pfpSize, pfpSize);

  if (options.presetImage) {
    const img = options.presetImage;
    const imgW = (img as HTMLImageElement).naturalWidth || img.width || 1;
    const imgH = (img as HTMLImageElement).naturalHeight || img.height || 1;
    const scale = Math.max(pfpSize / imgW, pfpSize / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;

    ctx.save();
    ctx.beginPath();
    ctx.rect(pfpX, pfpY, pfpSize, pfpSize);
    ctx.clip();
    ctx.drawImage(img, pfpX + (pfpSize - drawW) / 2, pfpY + (pfpSize - drawH) / 2, drawW, drawH);
    ctx.restore();
  }

  // Name & Quote Centered (no brackets, no quotes, with word wrap)
  const textColor = spec.textColor || '#FFFF00';
  const nameY = pfpY + pfpSize + Math.round(72 * s);
  ctx.fillStyle = textColor;
  ctx.font = `italic 700 ${Math.round(52 * s)}px "serif", Georgia, serif`;
  ctx.textAlign = 'center';
  const uname = (spec.username || 'USERNAME').toUpperCase();
  ctx.fillText(uname, targetW / 2, nameY);

  const quoteY = nameY + Math.round(52 * s);
  const quoteSize = Math.round(38 * s);
  ctx.font = `italic 400 ${quoteSize}px "serif", Georgia, serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  const maxWidth = targetW - pad * 2;
  drawWrappedText(ctx, spec.quote || 'eternal', targetW / 2, quoteY, maxWidth, Math.round(quoteSize * 1.25), 4);

  return canvas;
}

/**
 * Master dispatcher
 */
export function composeCardByStyle(
  options: ComposeCardOptions,
  targetCanvas?: HTMLCanvasElement,
): HTMLCanvasElement {
  const style = options.style || 'poster-split';
  switch (style) {
    case 'editorial-cover':
      return composeEditorialCover(options, targetCanvas);
    case 'swiss-asymmetric':
      return composeSwissModern(options, targetCanvas);
    case 'minimalist-dark':
      return composeObsidianNoir(options, targetCanvas);
    case 'poster-split':
    default:
      return composePosterSplit(options, targetCanvas);
  }
}
