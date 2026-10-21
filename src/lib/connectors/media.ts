import "server-only";
import { safeFetch } from "@/lib/server/safe-fetch";
import { writeAsset } from "@/lib/server/files";
import { getConnectorSecrets } from "./index";
import { getConnector } from "./catalog";

type Args = { connector: string; kind: "image" | "video" | "audio"; prompt: string; path: string; model?: string; aspect_ratio?: string; duration_seconds?: number };

const EXT: Record<Args["kind"], Record<string, string>> = {
  image: { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" },
  video: { mp4: "video/mp4", webm: "video/webm" },
  audio: { mp3: "audio/mpeg", wav: "audio/wav" },
};
const MAX_BYTES: Record<Args["kind"], number> = { image: 12_000_000, video: 45_000_000, audio: 15_000_000 };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function download(url: string, kind: Args["kind"]) {
  const res = await safeFetch(url, { maxBytes: MAX_BYTES[kind], timeoutMs: 120_000 });
  if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`);
  return res.buffer;
}

function firstUrl(obj: unknown): string | null {
  if (!obj) return null;
  if (typeof obj === "string") return /^https:\/\//.test(obj) ? obj : null;
  if (Array.isArray(obj)) {
    for (const v of obj) {
      const u = firstUrl(v);
      if (u) return u;
    }
    return null;
  }
  if (typeof obj === "object") {
    const o = obj as Record<string, unknown>;
    for (const k of ["video", "audio", "audio_file", "image", "images", "url", "output"]) {
      const u = firstUrl(o[k]);
      if (u) return u;
    }
    for (const v of Object.values(o)) {
      const u = firstUrl(v);
      if (u) return u;
    }
  }
  return null;
}

async function viaFal(key: string, a: Args, signal: AbortSignal) {
  const model = a.model || (a.kind === "image" ? "fal-ai/flux/schnell" : a.kind === "video" ? "fal-ai/ltx-video" : "fal-ai/stable-audio");
  if (!/^[\w.-]+\/[\w./-]+$/.test(model)) throw new Error("Invalid fal model id");
  const input: Record<string, unknown> = { prompt: a.prompt };
  if (a.aspect_ratio) input.aspect_ratio = a.aspect_ratio;
  if (a.kind === "image") input.image_size = a.aspect_ratio === "9:16" ? "portrait_16_9" : a.aspect_ratio === "1:1" ? "square_hd" : "landscape_16_9";
  if (a.duration_seconds) input.duration = a.duration_seconds;
  const res = await fetch(`https://queue.fal.run/${model}`, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  if (!res.ok) throw new Error(`fal.ai: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const job = (await res.json()) as { status_url: string; response_url: string };
  const deadline = Date.now() + 8 * 60_000;
  while (Date.now() < deadline) {
    await sleep(2500);
    const st = (await (await fetch(job.status_url, { headers: { Authorization: `Key ${key}` }, signal })).json()) as { status: string };
    if (st.status === "COMPLETED") break;
    if (st.status === "FAILED" || st.status === "ERROR") throw new Error("fal.ai generation failed");
  }
  const out = await (await fetch(job.response_url, { headers: { Authorization: `Key ${key}` }, signal })).json();
  const url = firstUrl(out);
  if (!url) throw new Error("fal.ai returned no file");
  return download(url, a.kind);
}

async function viaReplicate(token: string, a: Args, signal: AbortSignal) {
  const model = a.model || (a.kind === "image" ? "black-forest-labs/flux-schnell" : a.kind === "video" ? "bytedance/seedance-1-lite" : "meta/musicgen");
  if (!/^[\w.-]+\/[\w.-]+$/.test(model)) throw new Error("Invalid Replicate model id");
  const input: Record<string, unknown> = { prompt: a.prompt };
  if (a.aspect_ratio) input.aspect_ratio = a.aspect_ratio;
  if (a.duration_seconds) input.duration = a.duration_seconds;
  const res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "wait=55" },
    body: JSON.stringify({ input }),
    signal,
  });
  if (!res.ok) throw new Error(`Replicate: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  let pred = (await res.json()) as { status: string; output: unknown; urls: { get: string }; error?: string };
  const deadline = Date.now() + 8 * 60_000;
  while ((pred.status === "starting" || pred.status === "processing") && Date.now() < deadline) {
    await sleep(3000);
    pred = await (await fetch(pred.urls.get, { headers: { Authorization: `Bearer ${token}` }, signal })).json();
  }
  if (pred.status !== "succeeded") throw new Error(`Replicate generation ${pred.status}${pred.error ? `: ${pred.error}` : ""}`);
  const url = firstUrl(pred.output);
  if (!url) throw new Error("Replicate returned no file");
  return download(url, a.kind);
}

async function viaOpenAI(key: string, a: Args, signal: AbortSignal) {
  if (a.kind === "image") {
    const size = a.aspect_ratio === "9:16" ? "1024x1536" : a.aspect_ratio === "1:1" ? "1024x1024" : "1536x1024";
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: a.model || "gpt-image-1", prompt: a.prompt, size }),
      signal,
    });
    if (!res.ok) throw new Error(`OpenAI: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { data: { b64_json?: string; url?: string }[] };
    if (data.data[0]?.b64_json) return Buffer.from(data.data[0].b64_json, "base64");
    if (data.data[0]?.url) return download(data.data[0].url, "image");
    throw new Error("OpenAI returned no image");
  }
  if (a.kind === "audio") {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: a.model || "gpt-4o-mini-tts", voice: "alloy", input: a.prompt.slice(0, 4000), response_format: "mp3" }),
      signal,
    });
    if (!res.ok) throw new Error(`OpenAI: HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  throw new Error("OpenAI connector does not generate videos here; use fal or Replicate.");
}

async function viaElevenLabs(key: string, a: Args, signal: AbortSignal) {
  if (a.kind !== "audio") throw new Error("ElevenLabs only generates audio.");
  const voice = a.model && /^[\w]{10,40}$/.test(a.model) ? a.model : "21m00Tcm4TlvDq8ikWAM";
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text: a.prompt.slice(0, 4000), model_id: "eleven_multilingual_v2" }),
    signal,
  });
  if (!res.ok) throw new Error(`ElevenLabs: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Generates a media file with the user's own provider key and stores it as a project asset. */
export async function generateMedia(userId: string, projectId: string, a: Args, signal: AbortSignal) {
  const def = getConnector(a.connector);
  if (!def?.media?.includes(a.kind)) throw new Error(`Connector "${a.connector}" cannot generate ${a.kind}. Connected media providers are listed in your context.`);
  const secrets = await getConnectorSecrets(userId, a.connector);
  if (!secrets) throw new Error(`The user hasn't connected ${def.name}. Ask them to add it in Settings → Connectors.`);
  const path = a.path.replace(/^\/+/, "");
  if (!path.startsWith("public/")) throw new Error("Media must be saved under public/ (e.g. public/media/hero.mp4)");
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const mime = EXT[a.kind][ext];
  if (!mime) throw new Error(`Use one of these extensions for ${a.kind}: ${Object.keys(EXT[a.kind]).join(", ")}`);
  let data: Buffer;
  switch (a.connector) {
    case "fal":
      data = await viaFal(secrets.FAL_KEY, a, signal);
      break;
    case "replicate":
      data = await viaReplicate(secrets.REPLICATE_API_TOKEN, a, signal);
      break;
    case "openai":
      data = await viaOpenAI(secrets.OPENAI_API_KEY, a, signal);
      break;
    case "elevenlabs":
      data = await viaElevenLabs(secrets.ELEVENLABS_API_KEY, a, signal);
      break;
    default:
      throw new Error(`${def.name} generation is not supported during builds.`);
  }
  if (data.length > MAX_BYTES[a.kind]) throw new Error("Generated file is too large");
  await writeAsset(projectId, path, data, mime);
  return { path, kind: a.kind, mime, size: data.length, publicUrl: `/${path.replace(/^public\//, "")}` };
}
