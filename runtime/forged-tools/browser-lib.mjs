// Shared browser connection: one headless Chromium per VM, reused across actions through CDP.
import { spawn } from "node:child_process";
import fs from "node:fs";
import { chromium } from "playwright-core";

const PORT = 9333;
const STATE = "/tmp/forged-browser.json";

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || "/ms-playwright";
  for (const dir of fs.readdirSync(root).filter((d) => d.startsWith("chromium-")).sort().reverse()) {
    for (const rel of ["chrome-linux64/chrome", "chrome-linux/chrome"]) {
      const p = `${root}/${dir}/${rel}`;
      if (fs.existsSync(p)) return p;
    }
  }
  throw new Error("Chromium not found in this VM image");
}

async function up() {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/json/version`, { signal: AbortSignal.timeout(800) });
    return r.ok;
  } catch {
    return false;
  }
}

export async function connect() {
  if (!(await up())) {
    const child = spawn(
      chromePath(),
      [
        "--headless=new",
        `--remote-debugging-port=${PORT}`,
        "--remote-debugging-address=127.0.0.1",
        "--no-sandbox", // the VM itself is the sandbox
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--mute-audio",
        "--window-size=1280,800",
        "about:blank",
      ],
      { detached: true, stdio: "ignore" },
    );
    child.unref();
    const deadline = Date.now() + 15_000;
    while (!(await up())) {
      if (Date.now() > deadline) throw new Error("Chromium did not start");
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
  const context = browser.contexts()[0] ?? (await browser.newContext({ viewport: { width: 1280, height: 800 } }));
  const page = context.pages()[0] ?? (await context.newPage());
  await page.setViewportSize({ width: 1280, height: 800 });
  return { browser, page };
}

export function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE, "utf8"));
  } catch {
    return { cursor: null };
  }
}

export function writeState(s) {
  fs.writeFileSync(STATE, JSON.stringify(s));
}
