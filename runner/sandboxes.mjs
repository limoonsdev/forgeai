// Docker-backed project VMs: one hardened container per project (gVisor when available).
import os from "node:os";
import fs from "node:fs";
import { PassThrough } from "node:stream";
import Docker from "dockerode";
import tar from "tar-stream";
import { env, log, safeRelativePath, shellQuote } from "./util.mjs";

export const docker = new Docker(process.env.DOCKER_HOST ? undefined : { socketPath: env("DOCKER_SOCKET", "/var/run/docker.sock") });

const IMAGE = env("FORGED_RUNTIME_IMAGE", "forged-runtime:latest");
const RUNTIME = env("FORGED_SANDBOX_RUNTIME", "");
const NETWORK = env("FORGED_SANDBOX_NETWORK", "forged-sbx");
const ROOT = "/app";
const UID = Number(env("FORGED_SANDBOX_UID", "10001"));
const BIND_IP = env("FORGED_SANDBOX_BIND_IP", "127.0.0.1");
const PREVIEW_TPL = env("FORGED_PREVIEW_URL_TEMPLATE", "http://localhost:{port}");
const LABEL = "dev.forged.project";
const DEV_LOG = "/tmp/forged-next.log";
const DEV_PID = "/tmp/forged-next.pid";

export function previewUrl(projectId, port) {
  return PREVIEW_TPL.replace("{port}", String(port)).replace("{id}", projectId);
}

/** Creates the isolated sandbox network once: no container-to-container traffic. */
export async function ensureNetwork() {
  const nets = await docker.listNetworks({ filters: { name: [NETWORK] } });
  if (nets.some((n) => n.Name === NETWORK)) return;
  await docker.createNetwork({
    Name: NETWORK,
    Driver: "bridge",
    Options: { "com.docker.network.bridge.enable_icc": "false", "com.docker.network.bridge.name": "br-forged-sbx" },
    Labels: { "dev.forged.network": "sandbox" },
  });
  log(`created network ${NETWORK}`);
}

export function hostConfig({ memoryMb, cpus, restart }) {
  return {
    PortBindings: { "3000/tcp": [{ HostIp: BIND_IP, HostPort: "" }] },
    Memory: memoryMb * 1024 * 1024,
    MemorySwap: memoryMb * 1024 * 1024,
    NanoCpus: Math.round(cpus * 1e9),
    PidsLimit: 512,
    Init: true,
    CapDrop: ["ALL"],
    SecurityOpt: ["no-new-privileges"],
    NetworkMode: NETWORK,
    ...(RUNTIME ? { Runtime: RUNTIME } : {}),
    ...(restart ? { RestartPolicy: { Name: "unless-stopped" } } : {}),
    Tmpfs: { "/tmp": "rw,nosuid,nodev,size=256m" },
    Ulimits: [{ Name: "nofile", Soft: 8192, Hard: 8192 }],
  };
}

export async function collectExec(container, cmd, timeoutMs = 120_000) {
  const seconds = Math.max(1, Math.ceil(timeoutMs / 1000));
  const exec = await container.exec({
    Cmd: ["sh", "-c", `timeout ${seconds} sh -c ${shellQuote(cmd)}`],
    AttachStdout: true,
    AttachStderr: true,
    WorkingDir: ROOT,
    User: String(UID),
  });
  const stream = await exec.start({ hijack: true, stdin: false });
  const out = new PassThrough();
  const err = new PassThrough();
  let stdout = "";
  let stderr = "";
  out.on("data", (d) => (stdout += d.toString("utf8")));
  err.on("data", (d) => (stderr += d.toString("utf8")));
  docker.modem.demuxStream(stream, out, err);
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs + 5000);
    stream.on("end", () => {
      clearTimeout(timer);
      resolve();
    });
    stream.on("error", resolve);
  });
  const info = await exec.inspect();
  return { exitCode: info.ExitCode ?? (info.Running ? 124 : 0), stdout: stdout.slice(-4_000_000), stderr: stderr.slice(-100_000) };
}

export async function putFiles(container, files) {
  if (!files.length) return;
  const pack = tar.pack();
  const dirs = new Set();
  for (const f of files) {
    const parts = f.path.split("/");
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join("/"));
  }
  for (const d of [...dirs].sort()) pack.entry({ name: d, type: "directory", mode: 0o755, uid: UID, gid: UID });
  for (const f of files) {
    const data = f.encoding === "base64" ? Buffer.from(f.content, "base64") : Buffer.from(f.content, "utf8");
    pack.entry({ name: f.path, mode: 0o644, uid: UID, gid: UID }, data);
  }
  pack.finalize();
  const chunks = [];
  for await (const c of pack) chunks.push(c);
  await container.putArchive(Buffer.concat(chunks), { path: ROOT });
}

async function findProjectContainer(projectId) {
  const list = await docker.listContainers({ all: true, filters: { label: [`${LABEL}=${projectId}`] } });
  return list[0] ?? null;
}

async function inspectInfo(id) {
  const info = await docker.getContainer(id).inspect();
  const port = info.NetworkSettings?.Ports?.["3000/tcp"]?.[0]?.HostPort;
  return { id, running: Boolean(info.State?.Running), port: port ? Number(port) : null, startedAt: info.State?.StartedAt };
}

export async function getSandbox(projectId) {
  const c = await findProjectContainer(projectId);
  if (!c) return null;
  const info = await inspectInfo(c.Id);
  if (!info.running) {
    await docker.getContainer(c.Id).remove({ force: true }).catch(() => {});
    return null;
  }
  return { ...info, previewUrl: previewUrl(projectId, info.port) };
}

export async function createSandbox(projectId) {
  const existing = await getSandbox(projectId);
  if (existing) return existing;
  await ensureNetwork();
  const container = await docker.createContainer({
    Image: IMAGE,
    name: `forged-${projectId}`,
    Labels: { [LABEL]: projectId, "dev.forged.kind": "preview" },
    User: String(UID),
    WorkingDir: ROOT,
    Cmd: ["sleep", "infinity"],
    ExposedPorts: { "3000/tcp": {} },
    Env: ["NEXT_TELEMETRY_DISABLED=1", "NODE_ENV=development", "PORT=3000", "HOSTNAME=0.0.0.0", "WATCHPACK_POLLING=true"],
    HostConfig: hostConfig({ memoryMb: Number(env("FORGED_SANDBOX_MEMORY_MB", "1536")), cpus: Number(env("FORGED_SANDBOX_CPUS", "1")) }),
  });
  await container.start();
  const info = await inspectInfo(container.id);
  log(`sandbox up ${projectId} → 127.0.0.1:${info.port}${RUNTIME ? ` (${RUNTIME})` : ""}`);
  return { ...info, previewUrl: previewUrl(projectId, info.port) };
}

export async function removeSandbox(projectId) {
  const c = await findProjectContainer(projectId);
  if (c) await docker.getContainer(c.Id).remove({ force: true }).catch(() => {});
}

export async function listSandboxes() {
  const list = await docker.listContainers({ filters: { label: [LABEL] } });
  return list.map((c) => ({ projectId: c.Labels[LABEL], id: c.Id, createdAt: c.Created * 1000 }));
}

export async function withSandbox(projectId, fn) {
  const c = await findProjectContainer(projectId);
  if (!c || c.State !== "running") throw Object.assign(new Error("Sandbox not running"), { status: 404 });
  return fn(docker.getContainer(c.Id));
}

export const devServerScript = () =>
  `if [ -f ${DEV_PID} ] && kill -0 "$(cat ${DEV_PID})" 2>/dev/null && ! grep -q "^State:.*Z" "/proc/$(cat ${DEV_PID})/status" 2>/dev/null; then echo up; else cd ${ROOT} && NEXT_TELEMETRY_DISABLED=1 nohup npx next dev -H 0.0.0.0 -p 3000 > ${DEV_LOG} 2>&1 < /dev/null & echo $! > ${DEV_PID}; echo started; fi`;

export const waitPortScript = (ms) =>
  `node -e ${shellQuote(`const net=require("net");const end=Date.now()+${ms};(function t(){const s=net.connect(3000,"127.0.0.1");s.on("connect",()=>{s.destroy();console.log("up");process.exit(0)});s.on("error",()=>{s.destroy();if(Date.now()>end){console.log("down");process.exit(0)}setTimeout(t,400)})})()`)}`;

export const httpGetScript = (path, ms) =>
  `node -e ${shellQuote(`const c=new AbortController();setTimeout(()=>c.abort(),${ms});fetch(${JSON.stringify(`http://127.0.0.1:3000${path}`)},{signal:c.signal}).then(async r=>{const t=await r.text();process.stdout.write(String(r.status)+"\\n"+t.slice(0,4000))}).catch(()=>process.stdout.write("0\\n"))`)}`;

export const DEV_LOG_PATH = DEV_LOG;

/** Host capacity: how many VMs fit, given memory, CPU load and configuration. */
export async function capacity() {
  const totalMb = Math.round(os.totalmem() / 1048576);
  let freeMb = Math.round(os.freemem() / 1048576);
  try {
    const m = fs.readFileSync("/proc/meminfo", "utf8").match(/MemAvailable:\s+(\d+) kB/);
    if (m) freeMb = Math.round(Number(m[1]) / 1024);
  } catch {}
  const vmMb = Number(env("FORGED_SANDBOX_MEMORY_MB", "1536"));
  const reservedMb = Number(env("FORGED_RESERVED_MEMORY_MB", "1200"));
  // Dev servers rarely use their full limit: budget ~45% of the limit per VM.
  const auto = Math.max(1, Math.floor((totalMb - reservedMb) / Math.max(400, vmMb * 0.45)));
  const maxVms = Number(env("FORGED_MAX_VMS", "0")) || auto;
  const running = (await listSandboxes()).length;
  const load1 = os.loadavg()[0];
  const cpus = os.cpus().length;
  const overloaded = load1 > cpus * 1.6 || freeMb < Number(env("FORGED_MIN_FREE_MEMORY_MB", "350"));
  return { maxVms, running, totalMb, freeMb, load1, cpus, overloaded, available: !overloaded && running < maxVms };
}
