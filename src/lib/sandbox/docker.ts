import "server-only";
import Docker from "dockerode";
import { PassThrough } from "node:stream";
import tar from "tar-stream";
import { DEV_LOG, devServerScript, httpProbeScript, shellQuote, waitForPortScript, type ExecResult, type SandboxHandle, type SandboxProvider } from "./types";

const ROOT = "/app";
const IMAGE = process.env.FORGED_RUNTIME_IMAGE || "forged-runtime:latest";
const LABEL = "dev.forged.project";

let docker: Docker | null = null;
function getDocker() {
  docker ??= new Docker(process.env.DOCKER_HOST ? undefined : { socketPath: process.env.DOCKER_SOCKET || "/var/run/docker.sock" });
  return docker;
}

function previewUrlFor(hostPort: string, containerIp: string) {
  const tpl = process.env.FORGED_PREVIEW_URL_TEMPLATE || "http://localhost:{port}";
  return tpl.replace("{port}", hostPort).replace("{ip}", containerIp);
}

async function collectExec(container: Docker.Container, cmd: string, timeoutMs: number): Promise<ExecResult> {
  const seconds = Math.max(1, Math.ceil(timeoutMs / 1000));
  const exec = await container.exec({
    Cmd: ["sh", "-c", `timeout ${seconds} sh -c ${shellQuote(cmd)}`],
    AttachStdout: true,
    AttachStderr: true,
    WorkingDir: ROOT,
    User: "node",
  });
  const stream = await exec.start({ hijack: true, stdin: false });
  const out = new PassThrough();
  const err = new PassThrough();
  let stdout = "";
  let stderr = "";
  out.on("data", (d: Buffer) => (stdout += d.toString("utf8")));
  err.on("data", (d: Buffer) => (stderr += d.toString("utf8")));
  getDocker().modem.demuxStream(stream, out, err);
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => resolve(), timeoutMs + 5000);
    stream.on("end", () => {
      clearTimeout(timer);
      resolve();
    });
    stream.on("error", () => resolve());
  });
  const info = await exec.inspect();
  const exitCode = info.ExitCode ?? (info.Running ? 124 : 0);
  return { exitCode, stdout: stdout.slice(-200_000), stderr: stderr.slice(-50_000) };
}

function handleFor(container: Docker.Container, id: string, previewUrl: string): SandboxHandle {
  return {
    id,
    previewUrl,
    root: ROOT,
    async writeFiles(files) {
      if (!files.length) return;
      const pack = tar.pack();
      const dirs = new Set<string>();
      for (const f of files) {
        const parts = f.path.split("/");
        for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join("/"));
      }
      for (const d of [...dirs].sort()) pack.entry({ name: d, type: "directory", mode: 0o755, uid: 1000, gid: 1000 });
      for (const f of files) pack.entry({ name: f.path, mode: 0o644, uid: 1000, gid: 1000 }, f.content);
      pack.finalize();
      const chunks: Buffer[] = [];
      for await (const c of pack) chunks.push(c as Buffer);
      await container.putArchive(Buffer.concat(chunks), { path: ROOT });
    },
    async deleteFiles(paths) {
      if (!paths.length) return;
      await collectExec(container, `rm -f ${paths.map((p) => shellQuote(p)).join(" ")}`, 10_000);
    },
    async readFile(path) {
      const r = await collectExec(container, `cat ${shellQuote(path)}`, 10_000);
      return r.exitCode === 0 ? r.stdout : null;
    },
    exec: (command, opts) => collectExec(container, command, opts?.timeoutMs ?? 120_000),
    async startDevServer() {
      await collectExec(container, devServerScript(ROOT), 15_000);
    },
    async waitForPort(timeoutMs = 60_000) {
      const r = await collectExec(container, waitForPortScript(timeoutMs), timeoutMs + 5000);
      return r.stdout.includes("up");
    },
    async httpGet(path, timeoutMs = 90_000) {
      const r = await collectExec(container, httpProbeScript(`http://127.0.0.1:3000${path}`, timeoutMs), timeoutMs + 5000);
      const [status, ...rest] = r.stdout.split("\n");
      return { status: Number(status) || 0, body: rest.join("\n") };
    },
    async logs(lines) {
      const r = await collectExec(container, `tail -n ${Math.min(Math.max(lines, 1), 1000)} ${DEV_LOG} 2>/dev/null`, 10_000);
      return r.stdout;
    },
    async keepAlive() {
      // Docker containers do not expire on their own; idle reaping uses the project's last activity.
    },
    async stop() {
      await container.remove({ force: true }).catch(() => {});
    },
  };
}

async function inspectPreview(container: Docker.Container) {
  const info = await container.inspect();
  const binding = info.NetworkSettings?.Ports?.["3000/tcp"]?.[0];
  const ip = Object.values(info.NetworkSettings?.Networks ?? {})[0]?.IPAddress || "127.0.0.1";
  return { running: Boolean(info.State?.Running), previewUrl: previewUrlFor(binding?.HostPort ?? "3000", ip) };
}

export const dockerProvider: SandboxProvider = {
  name: "docker",
  async create(projectId) {
    const d = getDocker();
    const memoryMb = Number(process.env.FORGED_SANDBOX_MEMORY_MB || 2048);
    const container = await d.createContainer({
      Image: IMAGE,
      name: `forged-${projectId}-${Date.now().toString(36)}`,
      Labels: { [LABEL]: projectId },
      User: "node",
      WorkingDir: ROOT,
      Cmd: ["sleep", "infinity"],
      ExposedPorts: { "3000/tcp": {} },
      Env: ["NEXT_TELEMETRY_DISABLED=1", "NODE_ENV=development", "PORT=3000", "HOSTNAME=0.0.0.0"],
      HostConfig: {
        PortBindings: { "3000/tcp": [{ HostIp: process.env.FORGED_SANDBOX_BIND_IP || "127.0.0.1", HostPort: "" }] },
        Memory: memoryMb * 1024 * 1024,
        NanoCpus: Number(process.env.FORGED_SANDBOX_CPUS || 2) * 1e9,
        PidsLimit: 1024,
        SecurityOpt: ["no-new-privileges"],
        CapDrop: ["ALL"],
        ...(process.env.FORGED_DOCKER_NETWORK ? { NetworkMode: process.env.FORGED_DOCKER_NETWORK } : {}),
      },
    });
    await container.start();
    const { previewUrl } = await inspectPreview(container);
    return handleFor(container, container.id, previewUrl);
  },
  async connect(id) {
    try {
      const container = getDocker().getContainer(id);
      const { running, previewUrl } = await inspectPreview(container);
      if (!running) {
        await container.remove({ force: true }).catch(() => {});
        return null;
      }
      return handleFor(container, id, previewUrl);
    } catch {
      return null;
    }
  },
};
