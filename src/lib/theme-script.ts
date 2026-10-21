export const THEME_KEY = "forged-theme";

/** Inline script injected in <head> so the correct theme is applied before first paint. */
export const themeScript = `(function(){try{var t=localStorage.getItem('${THEME_KEY}')||'dark';var r=t==='system'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):t;var c=document.documentElement.classList;r==='dark'?c.add('dark'):c.remove('dark');}catch(e){document.documentElement.classList.add('dark')}})();`;
