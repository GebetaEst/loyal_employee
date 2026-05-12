/**
 * Injects the restaurant's themeColor as CSS custom properties.
 * Called immediately after restaurant data is fetched.
 *
 * @param {string} hex - e.g. "#ff0000"
 */
export function applyTheme(hex) {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return;

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Darken by factor
  const darken = (v, f) => Math.max(0, Math.round(v * f));
  const toHex = (v) => v.toString(16).padStart(2, '0');

  const hoverHex = `#${toHex(darken(r, 0.88))}${toHex(darken(g, 0.88))}${toHex(darken(b, 0.88))}`;

  const root = document.documentElement;
  root.style.setProperty('--brand-primary', hex);
  root.style.setProperty('--brand-primary-hover', hoverHex);
  root.style.setProperty('--brand-primary-light', `rgba(${r},${g},${b},0.12)`);
  root.style.setProperty('--brand-primary-ring', `rgba(${r},${g},${b},0.35)`);

  // Decide text color based on luminance
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  root.style.setProperty('--brand-primary-text', luminance > 160 ? '#1a0f08' : '#ffffff');
}

/** Reset to default warm brown */
export function resetTheme() {
  const root = document.documentElement;
  root.style.setProperty('--brand-primary', '#8B5E3C');
  root.style.setProperty('--brand-primary-hover', '#7a5234');
  root.style.setProperty('--brand-primary-light', 'rgba(139,94,60,0.12)');
  root.style.setProperty('--brand-primary-ring', 'rgba(139,94,60,0.35)');
  root.style.setProperty('--brand-primary-text', '#ffffff');
}
