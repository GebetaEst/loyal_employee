/**
 * Injects the restaurant's themeColor as CSS custom properties on :root.
 * Supports any valid CSS color string: oklch, hex, rgb, hsl, etc.
 *
 * @param {string} color - e.g. "oklch(0.7 0.12 160)", "#8B5E3C", "hsl(160, 60%, 40%)"
 */
export function applyTheme(color) {
  if (!color || typeof color !== 'string') return;
  const trimmed = color.trim();
  if (!trimmed) return;

  const root = document.documentElement;

  // Set the primary brand color directly to CSS variable
  root.style.setProperty('--brand-primary', trimmed);

  // Modern CSS color-mix for hover, light accent, and ring
  root.style.setProperty('--brand-primary-hover', `color-mix(in srgb, ${trimmed}, #000000 12%)`);
  root.style.setProperty('--brand-primary-light', `color-mix(in srgb, ${trimmed} 12%, transparent)`);
  root.style.setProperty('--brand-primary-ring', `color-mix(in srgb, ${trimmed} 35%, transparent)`);

  // Calculate luminance using canvas context (handles all formats: oklch, hsl, rgb, hex, etc.)
  let isLightColor = false;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.fillStyle = trimmed;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      isLightColor = luminance > 165;
    }
  } catch {
    isLightColor = false;
  }

  root.style.setProperty('--brand-primary-text', isLightColor ? '#0f172a' : '#ffffff');
}

/** Reset to default restaurant brand color (e.g. oklch(0.7 0.12 160)) */
export function resetTheme() {
  const root = document.documentElement;
  const defaultColor = 'oklch(0.7 0.12 160)';
  root.style.setProperty('--brand-primary', defaultColor);
  root.style.setProperty('--brand-primary-hover', `color-mix(in srgb, ${defaultColor}, #000000 12%)`);
  root.style.setProperty('--brand-primary-light', `color-mix(in srgb, ${defaultColor} 12%, transparent)`);
  root.style.setProperty('--brand-primary-ring', `color-mix(in srgb, ${defaultColor} 35%, transparent)`);
  root.style.setProperty('--brand-primary-text', '#ffffff');
}
