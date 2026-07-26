const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp');

// Helper: Point to Line Segment Distance for exact antialiased vector rendering in Jimp
function distToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const c1 = wx * vx + wy * vy;
  if (c1 <= 0) return Math.hypot(px - ax, py - ay);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(px - bx, py - by);
  const b = c1 / c2;
  const projx = ax + b * vx;
  const projy = ay + b * vy;
  return Math.hypot(px - projx, py - projy);
}

// Generate high quality dedicated PWA icon with anti-aliased geometry
async function generatePwaIcon(size, isMaskable) {
  const container = new Jimp({ width: size, height: size, color: 0x090a0fff });
  const cx = size / 2;
  const cy = size / 2;
  // Scale content to stay strictly inside safe margin (55% for maskable, 85% for standard)
  const scale = (size / 512) * (isMaskable ? 0.55 : 0.85);

  const hexR = 170 * scale;
  const hexStroke = 24 * scale;
  const ticksR = 110 * scale;
  const tickLength = 20 * scale;
  const tickStroke = 7 * scale;

  // Hexagon vertices centered at (cx, cy)
  const hexVerts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    hexVerts.push({
      x: cx + hexR * Math.cos(angle),
      y: cy + hexR * Math.sin(angle)
    });
  }

  // Clock hands
  const hourAngle = (Math.PI / 180) * 120; // 4 o'clock
  const hourLen = 95 * scale;
  const hourX = cx + hourLen * Math.sin(hourAngle);
  const hourY = cy - hourLen * Math.cos(hourAngle);

  const minAngle = 0; // 12 o'clock
  const minLen = 135 * scale;
  const minX = cx + minLen * Math.sin(minAngle);
  const minY = cy - minLen * Math.cos(minAngle);

  // Badge box at bottom right
  const badgeCx = cx + 80 * scale;
  const badgeCy = cy + 80 * scale;
  const badgeR = 38 * scale;

  const maxDist = Math.hypot(cx, cy);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 1. Premium radial background (#1e2029 -> #090a0f)
      const distFromCenter = Math.hypot(x - cx, y - cy);
      const bgRatio = Math.min(1, distFromCenter / maxDist);
      let r = Math.round(30 * (1 - bgRatio) + 9 * bgRatio);
      let g = Math.round(32 * (1 - bgRatio) + 10 * bgRatio);
      let b = Math.round(41 * (1 - bgRatio) + 15 * bgRatio);

      // 2. Hexagonal Ring in Orange Gradient (#f97316 -> #ea580c)
      let minHexDist = Infinity;
      for (let i = 0; i < 6; i++) {
        const v1 = hexVerts[i];
        const v2 = hexVerts[(i + 1) % 6];
        const d = distToSegment(x, y, v1.x, v1.y, v2.x, v2.y);
        if (d < minHexDist) minHexDist = d;
      }

      if (minHexDist <= hexStroke / 2 + 1.5) {
        const alpha = Math.max(0, Math.min(1, 0.5 + (hexStroke / 2 - minHexDist)));
        const gradY = Math.max(0, Math.min(1, (y - (cy - hexR)) / (2 * hexR)));
        const hexR_val = Math.round(249 * (1 - gradY) + 234 * gradY);
        const hexG_val = Math.round(115 * (1 - gradY) + 88 * gradY);
        const hexB_val = Math.round(22 * (1 - gradY) + 12 * gradY);

        r = Math.round(r * (1 - alpha) + hexR_val * alpha);
        g = Math.round(g * (1 - alpha) + hexG_val * alpha);
        b = Math.round(b * (1 - alpha) + hexB_val * alpha);
      }

      // 3. Inner Dial Circle
      const dialDist = Math.abs(distFromCenter - ticksR);
      if (dialDist <= 2.5 * scale) {
        const alpha = Math.max(0, Math.min(1, 0.5 + (2.5 * scale - dialDist))) * 0.25;
        r = Math.round(r * (1 - alpha) + 248 * alpha);
        g = Math.round(g * (1 - alpha) + 250 * alpha);
        b = Math.round(b * (1 - alpha) + 252 * alpha);
      }

      // 4. Clock Ticks (12, 3, 6, 9)
      const tickAngles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
      for (const ta of tickAngles) {
        const t1x = cx + (ticksR - tickLength / 2) * Math.sin(ta);
        const t1y = cy - (ticksR - tickLength / 2) * Math.cos(ta);
        const t2x = cx + (ticksR + tickLength / 2) * Math.sin(ta);
        const t2y = cy - (ticksR + tickLength / 2) * Math.cos(ta);
        const td = distToSegment(x, y, t1x, t1y, t2x, t2y);
        if (td <= tickStroke / 2 + 1) {
          const alpha = Math.max(0, Math.min(1, 0.5 + (tickStroke / 2 - td))) * 0.85;
          r = Math.round(r * (1 - alpha) + 248 * alpha);
          g = Math.round(g * (1 - alpha) + 250 * alpha);
          b = Math.round(b * (1 - alpha) + 252 * alpha);
        }
      }

      // 5. Minute Hand (White)
      const minHandDist = distToSegment(x, y, cx, cy, minX, minY);
      if (minHandDist <= (9 * scale) / 2 + 1) {
        const alpha = Math.max(0, Math.min(1, 0.5 + ((9 * scale) / 2 - minHandDist)));
        r = Math.round(r * (1 - alpha) + 248 * alpha);
        g = Math.round(g * (1 - alpha) + 250 * alpha);
        b = Math.round(b * (1 - alpha) + 252 * alpha);
      }

      // 6. Hour Hand (Vivid Orange)
      const hourHandDist = distToSegment(x, y, cx, cy, hourX, hourY);
      if (hourHandDist <= (13 * scale) / 2 + 1) {
        const alpha = Math.max(0, Math.min(1, 0.5 + ((13 * scale) / 2 - hourHandDist)));
        r = Math.round(r * (1 - alpha) + 249 * alpha);
        g = Math.round(g * (1 - alpha) + 115 * alpha);
        b = Math.round(b * (1 - alpha) + 22 * alpha);
      }

      // 7. Center Hub Circle
      const hubDist = distFromCenter;
      if (hubDist <= 16 * scale + 1) {
        const alpha = Math.max(0, Math.min(1, 0.5 + (16 * scale - hubDist)));
        if (hubDist <= 6 * scale) {
          // Inner core dark
          r = Math.round(r * (1 - alpha) + 17 * alpha);
          g = Math.round(g * (1 - alpha) + 18 * alpha);
          b = Math.round(b * (1 - alpha) + 23 * alpha);
        } else {
          // Outer hub white
          r = Math.round(r * (1 - alpha) + 248 * alpha);
          g = Math.round(g * (1 - alpha) + 250 * alpha);
          b = Math.round(b * (1 - alpha) + 252 * alpha);
        }
      }

      // 8. HE Badge (Bottom-Right Pill/Circle)
      const badgeDist = Math.hypot(x - badgeCx, y - badgeCy);
      if (badgeDist <= badgeR + 1) {
        const alpha = Math.max(0, Math.min(1, 0.5 + (badgeR - badgeDist)));
        if (badgeDist <= badgeR - 4 * scale) {
          // Inner badge dark pill
          r = Math.round(r * (1 - alpha) + 17 * alpha);
          g = Math.round(g * (1 - alpha) + 18 * alpha);
          b = Math.round(b * (1 - alpha) + 23 * alpha);
        } else {
          // Outer badge glowing orange border
          r = Math.round(r * (1 - alpha) + 249 * alpha);
          g = Math.round(g * (1 - alpha) + 115 * alpha);
          b = Math.round(b * (1 - alpha) + 22 * alpha);
        }
      }

      const colorNum = ((r << 24) | (g << 16) | (b << 8) | 0xff) >>> 0;
      container.setPixelColor(colorNum, x, y);
    }
  }

  return container;
}

async function generate() {
  try {
    const publicDir = path.join(__dirname, '../public');
    const iconsDir = path.join(publicDir, 'icons');

    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
    if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

    console.log('[PWA Icon Generator] Generating distinct PWA and Browser icons...');

    // 1. Generate Favicon for Browser Tab from SERVITIUM_LOGO_BASE64
    const logoFileContent = fs.readFileSync(path.join(__dirname, '../src/assets/logoConstant.ts'), 'utf8');
    const base64Regex = /"data:image\/png;base64,([^"]+)"/;
    const match = logoFileContent.match(base64Regex);

    if (match) {
      const base64Data = match[1];
      const logoBuffer = Buffer.from(base64Data, 'base64');
      const logo = await Jimp.read(logoBuffer);

      // Favicon PNG (32x32) for Web Browser Tab
      const faviconContainer = new Jimp({ width: 32, height: 32, color: 0x090a0fff });
      const targetLogoWidth = 28;
      const targetLogoHeight = Math.round((logo.height / logo.width) * targetLogoWidth);
      logo.resize({ w: targetLogoWidth, h: targetLogoHeight });

      const fx = Math.round((32 - logo.width) / 2);
      const fy = Math.round((32 - logo.height) / 2);
      faviconContainer.composite(logo, fx, fy);
      await faviconContainer.write(path.join(publicDir, 'favicon.png'));
      console.log('[PWA Icon Generator] Generated favicon.png (Browser Tab Favicon with Servitium logo)');
    }

    // 2. Generate Dedicated PWA Icons (icons/icon-*.png and apple-touch-icon.png)
    const pwaIconDefinitions = [
      { path: 'apple-touch-icon.png', size: 180 },
      { path: 'icons/icon-48x48.png', size: 48 },
      { path: 'icons/icon-72x72.png', size: 72 },
      { path: 'icons/icon-96x96.png', size: 96 },
      { path: 'icons/icon-128x128.png', size: 128 },
      { path: 'icons/icon-144x144.png', size: 144 },
      { path: 'icons/icon-152x152.png', size: 152 },
      { path: 'icons/icon-167x167.png', size: 167 },
      { path: 'icons/icon-180x180.png', size: 180 },
      { path: 'icons/icon-192x192.png', size: 192 },
      { path: 'icons/icon-256x256.png', size: 256 },
      { path: 'icons/icon-384x384.png', size: 384 },
      { path: 'icons/icon-512x512.png', size: 512 },
      { path: 'icons/icon-512x512-maskable.png', size: 512 }
    ];

    for (const def of pwaIconDefinitions) {
      const isMaskable = def.path.includes('maskable');
      const pwaImage = await generatePwaIcon(def.size, isMaskable);
      await pwaImage.write(path.join(publicDir, def.path));
      console.log(`[PWA Icon Generator] Generated ${def.path} (${def.size}x${def.size} ${isMaskable ? 'Maskable' : 'Standard'} PWA Icon)`);
    }

    // 3. Generate SVGs
    // Browser Favicon SVG (Servitium Brand Logo SVG)
    const faviconSvgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <radialGradient id="favBg" cx="50%" cy="50%" r="75%">
      <stop offset="0%" stop-color="#1e2029" />
      <stop offset="100%" stop-color="#090a0f" />
    </radialGradient>
    <linearGradient id="orangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f97316" />
      <stop offset="100%" stop-color="#ea580c" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#favBg)" />
  <!-- Servitium Brand Logo Text/Emblem SVG Representation -->
  <text x="50%" y="46%" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="76" fill="#ffffff" text-anchor="middle" letter-spacing="4">SERVITIUM</text>
  <text x="50%" y="64%" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="42" fill="url(#orangeGrad)" text-anchor="middle" letter-spacing="8">HORAS EXTRAS</text>
  <rect x="96" y="370" width="320" height="8" rx="4" fill="url(#orangeGrad)" />
</svg>`;

    // Dedicated PWA Icon SVG (icons/icon.svg)
    const pwaSvgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <radialGradient id="pwaBgGrad" cx="50%" cy="50%" r="75%">
      <stop offset="0%" stop-color="#1e2029" />
      <stop offset="100%" stop-color="#090a0f" />
    </radialGradient>
    <linearGradient id="pwaGlowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f97316" />
      <stop offset="100%" stop-color="#ea580c" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  
  <!-- Outer PWA Container -->
  <rect width="512" height="512" rx="112" fill="url(#pwaBgGrad)" />
  
  <!-- Outer glowing hexagonal clock border -->
  <path d="M 256,64 L 422,160 L 422,352 L 256,448 L 90,352 L 90,160 Z" fill="none" stroke="url(#pwaGlowGrad)" stroke-width="24" stroke-linejoin="round" filter="url(#glow)" />
  
  <!-- Inner clock dial -->
  <circle cx="256" cy="256" r="110" fill="none" stroke="#f8fafc" stroke-width="6" opacity="0.15" />
  
  <!-- Clock Ticks -->
  <line x1="256" y1="110" x2="256" y2="130" stroke="#f8fafc" stroke-width="8" stroke-linecap="round" />
  <line x1="256" y1="382" x2="256" y2="402" stroke="#f8fafc" stroke-width="8" stroke-linecap="round" />
  <line x1="110" y1="256" x2="130" y2="256" stroke="#f8fafc" stroke-width="8" stroke-linecap="round" />
  <line x1="382" y1="256" x2="402" y2="256" stroke="#f8fafc" stroke-width="8" stroke-linecap="round" />
  
  <!-- Clock Hands -->
  <line x1="256" y1="256" x2="256" y2="150" stroke="#f8fafc" stroke-width="10" stroke-linecap="round" />
  <line x1="256" y1="256" x2="338" y2="304" stroke="url(#pwaGlowGrad)" stroke-width="14" stroke-linecap="round" />
  
  <!-- Center Pin -->
  <circle cx="256" cy="256" r="18" fill="#f8fafc" />
  <circle cx="256" cy="256" r="8" fill="#111217" />
  
  <!-- HE PWA Badge at Bottom-Right -->
  <g transform="translate(336, 336)">
    <rect width="90" height="90" rx="28" fill="#111217" stroke="url(#pwaGlowGrad)" stroke-width="6" />
    <text x="45" y="58" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="34" fill="#f97316" text-anchor="middle">HE</text>
  </g>
</svg>`;

    fs.writeFileSync(path.join(publicDir, 'favicon.svg'), faviconSvgContent);
    fs.writeFileSync(path.join(publicDir, 'icons/icon.svg'), pwaSvgContent);
    console.log('[PWA Icon Generator] Updated favicon.svg and icons/icon.svg successfully');

  } catch (err) {
    console.error('[PWA Icon Generator] Unhandled error during generation:', err);
    process.exit(1);
  }
}

generate();
