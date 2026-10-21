import "server-only";
import { Sandbox, CommandExitError } from "e2b";
import { DEV_LOG, devServerScript, httpProbeScript, shellQuote, waitForPortScript, type ExecResult, type SandboxHandle, type SandboxProvider } from "./types";

const ROOT = "/home/user/app";
const TEMPLATE = process.env.E2B_TEMPLATE || "forged-nextjs";
const TIMEOUT_MS = Number(process.env.FORGED_SANDBOX_TIMEOUT_MIN || 30) * 60_000;

async function run(sbx: Sandbox, cmd: string, timeoutMs: number): Promise<ExecResult> {
  try {
    const r = await sbx.commands.run(cmd, { cwd: ROOT, timeoutMs });
    return { exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr };
  } catch (err) {
    if (err instanceof CommandExitError) return { exitCode: err.exitCode, stdout: err.stdout, stderr: err.stderr };
    return { exitCode: 1, stdout: "", stderr: (err as Error).message };
  }
}

function handleFor(sbx: Sandbox): SandboxHandle {
  return {
    id: sbx.sandboxId,
    previewUrl: `https://${sbx.getHost(3000)}`,
    root: ROOT,
    async writeFiles(files) {
      if (!files.length) return;
      await sbx.files.write(files.map((f) => ({ path: `${ROOT}/${f.path}`, data: f.content })));
    },
    async writeBinary(files) {
      if (!files.length) return;
      await sbx.files.write(files.map((f) => ({ path: `${ROOT}/${f.path}`, data: new Uint8Array(Buffer.from(f.base64, "base64")).buffer })));
    },
    async deleteFiles(paths) {
      await Promise.all(paths.map((p) => sbx.files.remove(`${ROOT}/${p}`).catch(() => {})));
    },
    async readFile(path) {
      try {
        return await sbx.files.read(`${ROOT}/${path}`);
      } catch {
        return null;
      }
    },
    exec: (command, opts) => run(sbx, command, opts?.timeoutMs ?? 120_000),
    async startDevServer() {
      await run(sbx, devServerScript(ROOT), 15_000);
    },
    async waitForPort(timeoutMs = 60_000) {
      const r = await run(sbx, waitForPortScript(timeoutMs), timeoutMs + 5000);
      return r.stdout.includes("up");
    },
    async httpGet(path, timeoutMs = 90_000) {
      const r = await run(sbx, httpProbeScript(`http://127.0.0.1:3000${path}`, timeoutMs), timeoutMs + 5000);
      const [status, ...rest] = r.stdout.split("\n");
      return { status: Number(status) || 0, body: rest.join("\n") };
    },
    async logs(lines) {
      const r = await run(sbx, `tail -n ${Math.min(Math.max(lines, 1), 1000)} ${shellQuote(DEV_LOG)} 2>/dev/null`, 10_000);
      return r.stdout;
    },
    async keepAlive() {
      await sbx.setTimeout(TIMEOUT_MS).catch(() => {});
    },
    async restart() {
      await run(sbx, `if [ -f /tmp/forged-next.pid ]; then kill "$(cat /tmp/forged-next.pid)" 2>/dev/null; sleep 1; fi; rm -f /tmp/forged-next.pid; rm -rf ${ROOT}/.next/dev`, 15_000);
      await run(sbx, devServerScript(ROOT), 15_000);
      await run(sbx, waitForPortScript(60_000), 65_000);
    },
    async stop() {
      await sbx.kill().catch(() => {});
    },
  };
}

export const e2bProvider: SandboxProvider = {
  name: "e2b",
  async create(projectId) {
    const sbx = await Sandbox.create(TEMPLATE, { timeoutMs: TIMEOUT_MS, metadata: { projectId } });
    return handleFor(sbx);
  },
  async capacity() {
    return { maxVms: Number(process.env.FORGED_MAX_VMS || 50), running: 0, available: true, overloaded: false };
  },
  async connect(_projectId, id) {
    try {
      const sbx = await Sandbox.connect(id, { timeoutMs: TIMEOUT_MS });
      return handleFor(sbx);
    } catch {
      return null;
    }
  },
};
