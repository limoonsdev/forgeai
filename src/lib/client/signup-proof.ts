"use client";

/**
 * Browser side of the sign-up abuse checks (see lib/server/abuse/signup-guard.ts):
 *  1. a random device id mirrored in a cookie, localStorage and IndexedDB,
 *  2. two fingerprints: `fp` (this browser) and `hw` (signals shared by browsers on the same machine),
 *  3. a proof-of-work solved in a Web Worker so the page stays responsive.
 * Results are passed to the server as short-lived first-party cookies, which also reach the OAuth callback.
 */

const DID_KEY = "forged:did";
const secure = () => (location.protocol === "https:" ? "; secure" : "");

function setCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax${secure()}`;
}
function getCookie(name: string) {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function idb<T>(fn: (store: IDBObjectStore) => IDBRequest<T>, mode: IDBTransactionMode): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open("forged", 1);
      open.onupgradeneeded = () => open.result.createObjectStore("kv");
      open.onerror = () => resolve(null);
      open.onsuccess = () => {
        try {
          const tx = open.result.transaction("kv", mode);
          const req = fn(tx.objectStore("kv"));
          req.onsuccess = () => resolve(req.result ?? null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      };
    } catch {
      resolve(null);
    }
  });
}

export async function deviceId() {
  const valid = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{32}$/.test(v);
  let id: string | null = getCookie("forged_did");
  if (!valid(id)) {
    try {
      id = localStorage.getItem(DID_KEY);
    } catch {}
  }
  if (!valid(id)) id = (await Promise.race([idb((s) => s.get("did") as IDBRequest<string>, "readonly"), new Promise<null>((r) => setTimeout(() => r(null), 800))])) ?? null;
  if (!valid(id)) id = crypto.randomUUID().replace(/-/g, "");
  setCookie("forged_did", id, 365 * 86400);
  try {
    localStorage.setItem(DID_KEY, id);
  } catch {}
  void idb((s) => s.put(id, "did"), "readwrite");
  return id;
}

async function sha(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

function canvasSignal() {
  try {
    const c = document.createElement("canvas");
    c.width = 240;
    c.height = 60;
    const g = c.getContext("2d");
    if (!g) return "none";
    g.textBaseline = "top";
    g.font = "16px 'Arial'";
    const grad = g.createLinearGradient(0, 0, 240, 0);
    grad.addColorStop(0, "#f0421c");
    grad.addColorStop(1, "#2f5fe0");
    g.fillStyle = grad;
    g.fillRect(4, 4, 120, 26);
    g.fillStyle = "rgba(20,180,90,0.7)";
    g.fillText("Forged ✦ ÆØ 🔥 1.23", 8, 32);
    g.beginPath();
    g.arc(200, 30, 18, 0, Math.PI * 1.7);
    g.strokeStyle = "#ffb23f";
    g.stroke();
    return c.toDataURL();
  } catch {
    return "err";
  }
}

function webglSignal() {
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl") || c.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return { gpu: "none", params: "none" };
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const gpu = dbg ? `${gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)}|${gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)}` : `${gl.getParameter(gl.VENDOR)}|${gl.getParameter(gl.RENDERER)}`;
    const params = [gl.MAX_TEXTURE_SIZE, gl.MAX_RENDERBUFFER_SIZE, gl.MAX_VERTEX_ATTRIBS, gl.MAX_VARYING_VECTORS, gl.MAX_FRAGMENT_UNIFORM_VECTORS].map((p) => gl.getParameter(p)).join(",");
    return { gpu: String(gpu), params };
  } catch {
    return { gpu: "err", params: "err" };
  }
}

async function audioSignal() {
  try {
    const Ctx = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    if (!Ctx) return "none";
    const ctx = new Ctx(1, 4500, 44100);
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 10000;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -50;
    comp.knee.value = 40;
    comp.ratio.value = 12;
    osc.connect(comp);
    comp.connect(ctx.destination);
    osc.start(0);
    const buf = await Promise.race([ctx.startRendering(), new Promise<null>((r) => setTimeout(() => r(null), 600))]);
    if (!buf) return "timeout";
    const data = buf.getChannelData(0);
    let sum = 0;
    for (let i = 4000; i < 4500; i++) sum += Math.abs(data[i]);
    return sum.toFixed(6);
  } catch {
    return "err";
  }
}

const FONTS = ["Arial Black", "Calibri", "Cambria", "Candara", "Century Gothic", "Comic Sans MS", "Consolas", "Courier New", "Franklin Gothic Medium", "Futura", "Garamond", "Geneva", "Georgia", "Gill Sans", "Helvetica Neue", "Impact", "Lucida Console", "Lucida Grande", "Menlo", "Monaco", "Optima", "Palatino", "Segoe UI", "SF Pro Text", "Tahoma", "Trebuchet MS", "Ubuntu", "Verdana", "Noto Sans", "DejaVu Sans", "Liberation Sans", "Cantarell", "Roboto", "Avenir", "Baskerville", "Didot", "Hoefler Text", "MS Gothic", "Yu Gothic", "PingFang SC"];

function fontSignal() {
  try {
    const c = document.createElement("canvas").getContext("2d");
    if (!c) return "none";
    const text = "mmmmmmmmmmlli1WQ@";
    const base = ["monospace", "serif", "sans-serif"].map((f) => {
      c.font = `48px ${f}`;
      return c.measureText(text).width;
    });
    return FONTS.filter((font) =>
      ["monospace", "serif", "sans-serif"].some((f, i) => {
        c.font = `48px '${font}', ${f}`;
        return c.measureText(text).width !== base[i];
      }),
    ).join(",");
  } catch {
    return "err";
  }
}

export async function fingerprints() {
  const nav = navigator as Navigator & { deviceMemory?: number; userAgentData?: { platform?: string } };
  const gl = webglSignal();
  const fonts = fontSignal();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const screenSig = [screen.width, screen.height, screen.colorDepth, Math.round(devicePixelRatio * 100)].join("x");
  const hwParts = [screenSig, nav.hardwareConcurrency ?? 0, nav.deviceMemory ?? 0, nav.maxTouchPoints ?? 0, nav.userAgentData?.platform ?? nav.platform, gl.gpu, tz, fonts];
  const ua = nav.userAgent.replace(/(\d+)\.[\d.]+/g, "$1");
  const fpParts = [...hwParts, ua, nav.languages?.join(",") ?? nav.language, gl.params, canvasSignal(), await audioSignal(), matchMedia("(color-gamut: p3)").matches ? "p3" : "srgb"];
  const [fp, hw] = await Promise.all([sha(fpParts.join("|")), sha(hwParts.join("|"))]);
  return { fp, hw };
}

/* ── proof of work ── */

// Self-contained SHA-256 for the worker: much faster than crypto.subtle for millions of tiny inputs.
const WORKER_SRC = `
const K=new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
const W=new Uint32Array(64);
function sha256(bytes,len){
  const nblocks=((len+9+63)>>6);const buf=new Uint8Array(nblocks<<6);buf.set(bytes.subarray(0,len));buf[len]=0x80;
  const bits=len*8;buf[buf.length-4]=(bits>>>24)&255;buf[buf.length-3]=(bits>>>16)&255;buf[buf.length-2]=(bits>>>8)&255;buf[buf.length-1]=bits&255;
  let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
  for(let b=0;b<nblocks;b++){const o=b<<6;
    for(let i=0;i<16;i++){const j=o+(i<<2);W[i]=(buf[j]<<24)|(buf[j+1]<<16)|(buf[j+2]<<8)|buf[j+3];}
    for(let i=16;i<64;i++){const x=W[i-15],y=W[i-2];const s0=((x>>>7)|(x<<25))^((x>>>18)|(x<<14))^(x>>>3);const s1=((y>>>17)|(y<<15))^((y>>>19)|(y<<13))^(y>>>10);W[i]=(W[i-16]+s0+W[i-7]+s1)|0;}
    let a=h0,b2=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
    for(let i=0;i<64;i++){const S1=((e>>>6)|(e<<26))^((e>>>11)|(e<<21))^((e>>>25)|(e<<7));const ch=(e&f)^(~e&g);const t1=(h+S1+ch+K[i]+W[i])|0;const S0=((a>>>2)|(a<<30))^((a>>>13)|(a<<19))^((a>>>22)|(a<<10));const mj=(a&b2)^(a&c)^(b2&c);const t2=(S0+mj)|0;h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b2;b2=a;a=(t1+t2)|0;}
    h0=(h0+a)|0;h1=(h1+b2)|0;h2=(h2+c)|0;h3=(h3+d)|0;h4=(h4+e)|0;h5=(h5+f)|0;h6=(h6+g)|0;h7=(h7+h)|0;}
  return [h0>>>0,h1>>>0];
}
function lz(w){return w===0?32:Math.clz32(w);}
onmessage=(ev)=>{
  const {prefix,difficulty,start,step}=ev.data;
  const enc=new TextEncoder();const pre=enc.encode(prefix);const bytes=new Uint8Array(pre.length+16);bytes.set(pre);
  for(let n=start;;n+=step){
    const s=String(n);let len=pre.length;for(let i=0;i<s.length;i++)bytes[len++]=s.charCodeAt(i);
    const [a,b]=sha256(bytes,len);const bits=a===0?32+lz(b):lz(a);
    if(bits>=difficulty){postMessage({done:true,counter:n});return;}
    if((n-start)%(step*20000)===0)postMessage({done:false,tried:(n-start)/step});
  }
};`;

export async function solvePow(token: string, difficulty: number, onProgress?: (fraction: number) => void): Promise<string> {
  const expected = 2 ** difficulty;
  const threads = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
  const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" }));
  const workers: Worker[] = [];
  try {
    const counter = await new Promise<number>((resolve, reject) => {
      const tried = new Array(threads).fill(0);
      for (let t = 0; t < threads; t++) {
        const w = new Worker(url);
        workers.push(w);
        w.onmessage = (e: MessageEvent<{ done: boolean; counter?: number; tried?: number }>) => {
          if (e.data.done) resolve(e.data.counter!);
          else {
            tried[t] = e.data.tried ?? 0;
            onProgress?.(Math.min(0.95, tried.reduce((a, b) => a + b, 0) / expected));
          }
        };
        w.onerror = (err) => reject(err);
        w.postMessage({ prefix: `${token}:`, difficulty, start: t, step: threads });
      }
    });
    onProgress?.(1);
    return `${token}~${counter}`;
  } finally {
    workers.forEach((w) => w.terminate());
    URL.revokeObjectURL(url);
  }
}

export type ProofState = { phase: "idle" | "working" | "ready" | "error"; progress: number; error?: string };

/** Runs everything and stores the result in cookies. Resolves when the browser is ready to sign up. */
export async function prepareSignupProof(onProgress?: (p: number) => void) {
  const res = await fetch("/api/signup-check", { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message ?? "The security check is unavailable. Try again in a moment.");
  const [, prints, solution] = await Promise.all([deviceId(), fingerprints(), solvePow(data.token, data.difficulty, onProgress)]);
  setCookie("forged_fp", `${prints.fp}.${prints.hw}`, 3600);
  setCookie("forged_pow", solution, 600);
  return { expiresAt: Date.now() + 9 * 60_000 };
}
