// Production deployments: `next build` + `next start` in a hardened container, served at <sub>.<domain>.
import { collectExec, docker, ensureNetwork, hostConfig, putFiles } from "./sandboxes.mjs";
import { env, log } from "./util.mjs";

const IMAGE = env("FORGED_RUNTIME_IMAGE", "forged-runtime:latest");
const LABEL = "dev.forged.deploy";
const READY = "/app/.forged-deploy-ready";
const UID = env("FORGED_SANDBOX_UID", "10001");

/** In-memory build state (the database keeps the durable status). */
const builds = new Map(); // subdomain -> { status, log, startedAt, finishedAt }
const queue = [];
let building = false;

function appendLog(state, text) {
  state.log = (state.log + text).slice(-60_000);
}

export function deploymentState(sub) {
  return builds.get(sub) ?? null;
}

async function removeOld(sub, keepId) {
  const list = await docker.listContainers({ all: true, filters: { label: [`${LABEL}=${sub}`] } });
  for (const c of list) if (c.Id !== keepId) await docker.getContainer(c.Id).remove({ force: true }).catch(() => {});
}

async function build(job) {
  const { subdomain, files, env: appEnv } = job;
  const state = { status: "building", log: "", startedAt: Date.now(), finishedAt: null };
  builds.set(subdomain, state);
  let container;
  try {
    await ensureNetwork();
    container = await docker.createContainer({
      Image: IMAGE,
      name: `fdep-${subdomain}-${Date.now().toString(36)}`,
      Labels: { [LABEL]: subdomain, "dev.forged.kind": "deployment" },
      User: UID,
      WorkingDir: "/app",
      // On (re)start: serve the built app if ready, otherwise idle until the build finishes.
      Cmd: ["sh", "-c", `if [ -f ${READY} ]; then cd /app && exec npx next start -H 0.0.0.0 -p 3000; else exec sleep infinity; fi`],
      ExposedPorts: { "3000/tcp": {} },
      Env: ["NEXT_TELEMETRY_DISABLED=1", "NODE_ENV=production", "PORT=3000", "HOSTNAME=0.0.0.0", ...Object.entries(appEnv ?? {}).map(([k, v]) => `${k}=${v}`)],
      HostConfig: hostConfig({ memoryMb: Number(env("FORGED_BUILD_MEMORY_MB", "1536")), cpus: Number(env("FORGED_BUILD_CPUS", "1")), restart: true }),
    });
    await container.start();
    appendLog(state, "▸ Uploading files…\n");
    await putFiles(container, files);
    const pkg = files.find((f) => f.path === "package.json");
    const base = await collectExec(container, "cat package.json", 10_000);
    if (pkg && base.stdout.trim() !== pkg.content.trim()) {
      appendLog(state, "▸ Installing dependencies…\n");
      const r = await collectExec(container, "npm install --no-audit --no-fund --loglevel=error", 600_000);
      appendLog(state, r.stdout.slice(-4000) + r.stderr.slice(-4000));
      if (r.exitCode !== 0) throw new Error("npm install failed");
    }
    appendLog(state, "▸ Running next build…\n");
    const b = await collectExec(container, "NODE_ENV=production npx next build 2>&1", 900_000);
    appendLog(state, b.stdout.slice(-20_000));
    if (b.exitCode !== 0) throw new Error("next build failed");
    await collectExec(container, `touch ${READY}`, 5000);
    // Runtime memory is much lower than build memory.
    const runMb = Number(env("FORGED_DEPLOY_MEMORY_MB", "448"));
    await container.update({ Memory: runMb * 1024 * 1024, MemorySwap: runMb * 1024 * 1024 }).catch(() => {});
    await container.restart({ t: 1 });
    // Wait until next start answers.
    const deadline = Date.now() + 60_000;
    let up = false;
    while (Date.now() < deadline && !up) {
      const r = await collectExec(container, `node -e "require('net').connect(3000,'127.0.0.1').on('connect',()=>{console.log('up');process.exit(0)}).on('error',()=>process.exit(1))"`, 5000).catch(() => null);
      up = Boolean(r?.stdout.includes("up"));
      if (!up) await new Promise((r) => setTimeout(r, 1000));
    }
    if (!up) throw new Error("next start did not come up");
    await docker.getContainer(container.id).inspect();
    // Mark as ready for the gateway, then retire previous versions.
    await labelReady(container.id);
    state.status = "live";
    appendLog(state, "✓ Live\n");
    log(`deployment ${subdomain} live`);
  } catch (err) {
    state.status = "failed";
    appendLog(state, `✗ ${err.message}\n`);
    log(`deployment ${subdomain} failed: ${err.message}`);
    if (container) await container.remove({ force: true }).catch(() => {});
  } finally {
    state.finishedAt = Date.now();
  }
}

/** Docker labels are immutable: record readiness by renaming (gateway resolves by name suffix). */
async function labelReady(id) {
  const c = docker.getContainer(id);
  const info = await c.inspect();
  const sub = info.Config.Labels[LABEL];
  // Recreating would lose the build; instead keep a ready marker in the name and in an in-memory set.
  readyIds.add(id);
  await c.rename({ name: `fdep-${sub}-live-${Date.now().toString(36)}` });
  await removeOld(sub, id);
}

const readyIds = new Set();

/** Live deployment for a subdomain (ready marker in the container name). */
export async function resolveDeployment(sub) {
  const list = await docker.listContainers({ filters: { label: [`${LABEL}=${sub}`] } });
  const live = list.filter((c) => c.Names.some((n) => n.includes(`fdep-${sub}-live-`)) || readyIds.has(c.Id)).sort((a, b) => b.Created - a.Created)[0];
  if (!live) return null;
  const port = live.Ports.find((p) => p.PrivatePort === 3000)?.PublicPort;
  return port ? { id: live.Id, port } : null;
}

async function pump() {
  if (building) return;
  const job = queue.shift();
  if (!job) return;
  building = true;
  try {
    await build(job);
  } finally {
    building = false;
    setImmediate(pump);
  }
}

export function enqueueDeployment(job) {
  const existing = queue.findIndex((j) => j.subdomain === job.subdomain);
  if (existing >= 0) queue.splice(existing, 1);
  queue.push(job);
  builds.set(job.subdomain, { status: "queued", log: `Queued (position ${queue.length})\n`, startedAt: Date.now(), finishedAt: null });
  void pump();
  return queue.length;
}

export async function removeDeployment(sub) {
  const list = await docker.listContainers({ all: true, filters: { label: [`${LABEL}=${sub}`] } });
  for (const c of list) await docker.getContainer(c.Id).remove({ force: true }).catch(() => {});
  builds.delete(sub);
}
