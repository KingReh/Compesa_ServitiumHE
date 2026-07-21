const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp');

async function generate() {
  try {
    // Read the logoConstant.ts file
    const logoFileContent = fs.readFileSync(path.join(__dirname, '../src/assets/logoConstant.ts'), 'utf8');

    // Extract the base64 string
    const base64Regex = /"data:image\/png;base64,([^"]+)"/;
    const match = logoFileContent.match(base64Regex);

    if (!match) {
      console.error('Failed to find SERVITIUM_LOGO_BASE64 in src/assets/logoConstant.ts');
      process.exit(1);
    }

    const base64Data = match[1];
    const buffer = Buffer.from(base64Data, 'base64');

    // Create the target directories if they don't exist
    const publicDir = path.join(__dirname, '../public');
    const iconsDir = path.join(publicDir, 'icons');

    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    if (!fs.existsSync(iconsDir)) {
      fs.mkdirSync(iconsDir, { recursive: true });
    }

    // List of size mappings to generate
    const iconDefinitions = [
      { path: 'favicon.png', size: 32 },
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

    console.log('[PWA Icon Generator] Starting image processing...');

    for (const def of iconDefinitions) {
      const fullPath = path.join(publicDir, def.path);
      
      // Load fresh logo image instance for each size (so resize doesn't compound)
      const logo = await Jimp.read(buffer);

      // Create a square container with the theme background color
      const container = new Jimp({ width: def.size, height: def.size, color: 0x111217ff });

      // Target logo width should be roughly 75% of container size to have beautiful padding
      const targetLogoWidth = Math.max(16, Math.round(def.size * 0.75));
      const targetLogoHeight = Math.round((logo.height / logo.width) * targetLogoWidth);

      // Resize the logo
      logo.resize({ w: targetLogoWidth, h: targetLogoHeight });

      // Compute centered position
      const x = Math.round((def.size - logo.width) / 2);
      const y = Math.round((def.size - logo.height) / 2);

      // Composite onto the background
      container.composite(logo, x, y);

      // Write to destination
      await container.write(fullPath);
      console.log(`[PWA Icon Generator] Generated ${def.path} physically resized to ${def.size}x${def.size}`);
    }

    // Generate SVGs
    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <radialGradient id="bgGrad" cx="50%" cy="50%" r="75%">
      <stop offset="0%" stop-color="#1e2029" />
      <stop offset="100%" stop-color="#090a0f" />
    </radialGradient>
    <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f97316" />
      <stop offset="100%" stop-color="#ea580c" />
    </linearGradient>
  </defs>
  
  <!-- Outer PWA Maskable Shape -->
  <rect width="512" height="512" rx="112" fill="url(#bgGrad)" />
  
  <!-- Outer hexagonal clock border -->
  <path d="M 256,64 L 422,160 L 422,352 L 256,448 L 90,352 L 90,160 Z" fill="none" stroke="url(#glowGrad)" stroke-width="24" stroke-linejoin="round" />
  
  <!-- Inner clock details -->
  <circle cx="256" cy="256" r="110" fill="none" stroke="#f8fafc" stroke-width="8" opacity="0.1" />
  
  <!-- Clock ticks -->
  <line x1="256" y1="110" x2="256" y2="130" stroke="#f8fafc" stroke-width="8" stroke-linecap="round" />
  <line x1="256" y1="382" x2="256" y2="402" stroke="#f8fafc" stroke-width="8" stroke-linecap="round" />
  <line x1="110" y1="256" x2="130" y2="256" stroke="#f8fafc" stroke-width="8" stroke-linecap="round" />
  <line x1="382" y1="256" x2="402" y2="256" stroke="#f8fafc" stroke-width="8" stroke-linecap="round" />
  
  <!-- Clock Hands indicating hours extra / productivity -->
  <line x1="256" y1="256" x2="256" y2="160" stroke="url(#glowGrad)" stroke-width="12" stroke-linecap="round" />
  <line x1="256" y1="256" x2="330" y2="290" stroke="#f8fafc" stroke-width="10" stroke-linecap="round" />
  <circle cx="256" cy="256" r="18" fill="#f8fafc" />
  <circle cx="256" cy="256" r="8" fill="#090a0f" />
</svg>`;

    fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgContent);
    fs.writeFileSync(path.join(publicDir, 'icons/icon.svg'), svgContent);
    console.log('[PWA Icon Generator] Generated favicon.svg and icons/icon.svg successfully');

  } catch (err) {
    console.error('[PWA Icon Generator] Unhandled error during generation:', err);
    process.exit(1);
  }
}

generate();

