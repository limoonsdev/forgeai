export type ExecResult = { exitCode: number; stdout: string; stderr: string };

export interface SandboxHandle {
  id: string;
  previewUrl: string;
  /** Absolute path of the project root inside the VM. */
  root: string;
  writeFiles(files: { path: string; content: string }[]): Promise<void>;
  deleteFiles(paths: string[]): Promise<void>;
  readFile(path: string): Promise<string | null>;
  exec(command: string, opts?: { timeoutMs?: number }): Promise<ExecResult>;
  /** Starts `next dev` in the background (idempotent). */
  startDevServer(): Promise<void>;
  /** Resolves once the dev server accepts TCP connections (or the timeout elapses). */
  waitForPort(timeoutMs?: number): Promise<boolean>;
  /** Fetches a route from inside the VM: returns HTTP status (0 = unreachable). */
  httpGet(path: string, timeoutMs?: number): Promise<{ status: number; body: string }>;
  logs(lines: number): Promise<string>;
  keepAlive(): Promise<void>;
  stop(): Promise<void>;
}

export interface SandboxProvider {
  name: "docker" | "e2b";
  create(projectId: string): Promise<SandboxHandle>;
  connect(id: string): Promise<SandboxHandle | null>;
  /** Stops VMs idle for longer than `maxIdleMs` (best effort). */
  reap?(maxIdleMs: number): Promise<void>;
}

export const DEV_LOG = "/tmp/forged-next.log";
const DEV_PID = "/tmp/forged-next.pid";

/** Starts `next dev` in the background unless it is already running (tracked with a pid file). */
export function devServerScript(root: string) {
  return `if [ -f ${DEV_PID} ] && kill -0 "$(cat ${DEV_PID})" 2>/dev/null; then echo up; else cd ${root} && NEXT_TELEMETRY_DISABLED=1 nohup npx next dev -H 0.0.0.0 -p 3000 > ${DEV_LOG} 2>&1 < /dev/null & echo $! > ${DEV_PID}; echo started; fi`;
}

/** Paths are confined to the project root — never absolute, never escaping with "..". */
export function safeRelativePath(p: string): string | null {
  const cleaned = p.replace(/\\/g, "/").replace(/^\.\/+/, "").replace(/\/+/g, "/").trim();
  if (!cleaned || cleaned.startsWith("/") || cleaned.length > 300) return null;
  const segments = cleaned.split("/");
  if (segments.some((s) => s === ".." || s === "." || s === "")) return null;
  if (segments[0] === "node_modules" || segments[0] === ".next" || segments[0] === ".git") return null;
  return cleaned;
}

export function shellQuote(s: string) {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** Polls port 3000 inside the VM until it accepts connections. */
export function waitForPortScript(timeoutMs: number) {
  return `node -e ${shellQuote(
    `const net=require("net");const end=Date.now()+${timeoutMs};(function t(){const s=net.connect(3000,"127.0.0.1");s.on("connect",()=>{s.destroy();console.log("up");process.exit(0)});s.on("error",()=>{s.destroy();if(Date.now()>end){console.log("down");process.exit(0)}setTimeout(t,500)})})()`,
  )}`;
}

/** Node one-liner used to probe the dev server without curl. */
export function httpProbeScript(url: string, timeoutMs: number) {
  return `node -e ${shellQuote(
    `const c=new AbortController();setTimeout(()=>c.abort(),${timeoutMs});fetch(${JSON.stringify(url)},{signal:c.signal}).then(async r=>{const t=await r.text();process.stdout.write(String(r.status)+"\\n"+t.slice(0,4000))}).catch(()=>process.stdout.write("0\\n"))`,
  )}`;
}
