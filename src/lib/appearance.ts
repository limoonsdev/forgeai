/**
 * Per-browser appearance settings (accent colour, radius, text size, font, motion, custom CSS).
 * Stored in localStorage only — nothing is sent to the server.
 */
export type AccentPreset = "forge" | "ember" | "amber" | "cobalt" | "jade" | "iris" | "steel";

export type Appearance = {
  accent: AccentPreset | "custom";
  customAccent: string; // #rrggbb
  radius: number; // px, 0–20
  scale: number; // %, 87.5–112.5
  font: "archivo" | "system";
  motion: "full" | "reduced";
  customCss: string;
};

export const APPEARANCE_KEY = "forged-appearance";
export const APPEARANCE_EVENT = "forged:appearance";

export const DEFAULT_APPEARANCE: Appearance = {
  accent: "forge",
  customAccent: "#ff6b1a",
  radius: 11,
  scale: 100,
  font: "archivo",
  motion: "full",
  customCss: "",
};

/** hot → brand → glow, plus the text colour used on top of the brand colour. */
export const ACCENTS: Record<AccentPreset, { label: string; brand: string; hot: string; glow: string; fg: string }> = {
  forge: { label: "Forge", brand: "#ff6b1a", hot: "#f0421c", glow: "#ffb23f", fg: "#1a0a03" },
  ember: { label: "Ember", brand: "#f2452f", hot: "#c81e2a", glow: "#ff8a4c", fg: "#1a0504" },
  amber: { label: "Amber", brand: "#ffb020", hot: "#f07a12", glow: "#ffe08a", fg: "#1c1102" },
  cobalt: { label: "Cobalt", brand: "#4c8dff", hot: "#2f5fe0", glow: "#9cc3ff", fg: "#030b1c" },
  jade: { label: "Jade", brand: "#2fd08a", hot: "#119a68", glow: "#9ef0c6", fg: "#021a10" },
  iris: { label: "Iris", brand: "#9b7bff", hot: "#6c47f0", glow: "#cdbdff", fg: "#0d0620" },
  steel: { label: "Steel", brand: "#d9d4cf", hot: "#a29a93", glow: "#ffffff", fg: "#141110" },
};

const HEX = /^#[0-9a-f]{6}$/i;

export function sanitizeAppearance(input: unknown): Appearance {
  const a = { ...DEFAULT_APPEARANCE, ...(typeof input === "object" && input ? (input as Partial<Appearance>) : {}) };
  return {
    accent: a.accent === "custom" || a.accent in ACCENTS ? a.accent : "forge",
    customAccent: HEX.test(a.customAccent) ? a.customAccent.toLowerCase() : DEFAULT_APPEARANCE.customAccent,
    radius: clamp(Number(a.radius), 0, 20, DEFAULT_APPEARANCE.radius),
    scale: clamp(Number(a.scale), 87.5, 112.5, 100),
    font: a.font === "system" ? "system" : "archivo",
    motion: a.motion === "reduced" ? "reduced" : "full",
    customCss: typeof a.customCss === "string" ? a.customCss.slice(0, 20_000) : "",
  };
}

function clamp(n: number, min: number, max: number, fallback: number) {
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/**
 * Custom CSS is applied in the user's own browser only. Anything that could load a remote
 * resource (and leak page content through attribute selectors) is stripped.
 */
export function sanitizeCss(css: string) {
  return css
    .replace(/<\/?style/gi, "")
    .replace(/@import[^;]*;?/gi, "")
    .replace(/url\s*\(/gi, "none(")
    .replace(/image-set\s*\(/gi, "none(")
    .replace(/expression\s*\(/gi, "none(")
    .replace(/@font-face/gi, "@x-font-face")
    .replace(/\\/g, "");
}

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function accentVars(a: Appearance) {
  if (a.accent !== "custom") {
    const p = ACCENTS[a.accent];
    return { "--brand": p.brand, "--brand-hot": p.hot, "--brand-glow": p.glow, "--brand-fg": p.fg };
  }
  const hex = a.customAccent;
  return {
    "--brand": hex,
    "--brand-hot": `color-mix(in oklch, ${hex} 78%, black)`,
    "--brand-glow": `color-mix(in oklch, ${hex} 55%, white)`,
    "--brand-fg": luminance(hex) > 0.22 ? "#120c0a" : "#ffffff",
  };
}

export function applyAppearance(a: Appearance) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(accentVars(a))) root.style.setProperty(k, v);
  root.style.setProperty("--radius", `${a.radius / 16}rem`);
  root.style.setProperty("--ui-scale", `${a.scale}%`);
  if (a.font === "system") root.style.setProperty("--font-archivo", "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif");
  else root.style.removeProperty("--font-archivo");
  root.dataset.motion = a.motion;
  let style = document.getElementById("forged-custom-css");
  if (a.customCss.trim()) {
    if (!style) {
      style = document.createElement("style");
      style.id = "forged-custom-css";
      document.head.appendChild(style);
    }
    style.textContent = sanitizeCss(a.customCss);
  } else style?.remove();
}

export function loadAppearance(): Appearance {
  try {
    return sanitizeAppearance(JSON.parse(localStorage.getItem(APPEARANCE_KEY) || "{}"));
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function saveAppearance(a: Appearance) {
  const clean = sanitizeAppearance(a);
  try {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(clean));
  } catch {}
  applyAppearance(clean);
  window.dispatchEvent(new CustomEvent(APPEARANCE_EVENT, { detail: clean }));
  return clean;
}

/**
 * Inline <head> script: applies saved appearance before first paint (no flash).
 * Hand-written ES5 (function sources are minified in production builds, so they can't be stringified).
 * Mirrors sanitizeAppearance / accentVars / applyAppearance above.
 */
export const appearanceScript = `;(function(){try{
var raw=localStorage.getItem(${JSON.stringify(APPEARANCE_KEY)});if(!raw)return;var a=JSON.parse(raw)||{};
var P=${JSON.stringify(ACCENTS)};var r=document.documentElement,s=r.style;
function num(v,min,max,d){v=Number(v);return isFinite(v)?Math.min(max,Math.max(min,v)):d}
function lum(h){var n=parseInt(h.slice(1),16),c=[(n>>16)&255,(n>>8)&255,n&255].map(function(v){v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]}
var v;if(a.accent==='custom'&&/^#[0-9a-f]{6}$/i.test(a.customAccent||'')){var h=a.customAccent;v={'--brand':h,'--brand-hot':'color-mix(in oklch, '+h+' 78%, black)','--brand-glow':'color-mix(in oklch, '+h+' 55%, white)','--brand-fg':lum(h)>0.22?'#120c0a':'#ffffff'}}
else{var p=P[a.accent];if(p)v={'--brand':p.brand,'--brand-hot':p.hot,'--brand-glow':p.glow,'--brand-fg':p.fg}}
if(v)for(var k in v)s.setProperty(k,v[k]);
s.setProperty('--radius',num(a.radius,0,20,11)/16+'rem');s.setProperty('--ui-scale',num(a.scale,87.5,112.5,100)+'%');
if(a.font==='system')s.setProperty('--font-archivo',"ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif");
r.setAttribute('data-motion',a.motion==='reduced'?'reduced':'full');
var css=typeof a.customCss==='string'?a.customCss.slice(0,20000):'';
if(css.replace(/\\s/g,'')){css=css.replace(/<\\/?style/gi,'').replace(/@import[^;]*;?/gi,'').replace(/url\\s*\\(/gi,'none(').replace(/image-set\\s*\\(/gi,'none(').replace(/expression\\s*\\(/gi,'none(').replace(/@font-face/gi,'@x-font-face').replace(/\\\\/g,'');
var el=document.createElement('style');el.id='forged-custom-css';el.textContent=css;document.head.appendChild(el)}
}catch(e){}})();`;
