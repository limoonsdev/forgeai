// Usage: node browser.mjs '<json action>'  → prints one JSON line {image, cursor, url, title, label, consoleErrors}
import { connect, readState, writeState } from "./browser-lib.mjs";

const action = JSON.parse(process.argv[2] || "{}");
const state = readState();
const { browser, page } = await connect();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 300)));
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 300)));

let label = "";
const settle = async () => {
  await page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(450);
};
// Smoothly glide the virtual cursor so the motion reads as a real hand on the mouse.
const glide = async (x, y) => {
  const from = state.cursor ?? { x: 640, y: 400 };
  const steps = Math.max(8, Math.round(Math.hypot(x - from.x, y - from.y) / 40));
  await page.mouse.move(from.x, from.y);
  await page.mouse.move(x, y, { steps });
  state.cursor = { x, y };
};

try {
  switch (action.action) {
    case "open": {
      const path = typeof action.path === "string" && action.path.startsWith("/") ? action.path : "/";
      await page.goto(`http://localhost:3000${path}`, { waitUntil: "load", timeout: 60_000 });
      await settle();
      label = `Opened ${path}`;
      break;
    }
    case "click": {
      await glide(Number(action.x) || 0, Number(action.y) || 0);
      await page.mouse.down();
      await page.waitForTimeout(60);
      await page.mouse.up();
      await settle();
      label = `Clicked at (${Math.round(action.x)}, ${Math.round(action.y)})`;
      break;
    }
    case "type":
      await page.keyboard.type(String(action.text ?? ""), { delay: 25 });
      await page.waitForTimeout(250);
      label = `Typed “${String(action.text ?? "").slice(0, 40)}”`;
      break;
    case "press":
      await page.keyboard.press(String(action.key ?? "Enter"));
      await settle();
      label = `Pressed ${action.key}`;
      break;
    case "scroll":
      if (state.cursor) await page.mouse.move(state.cursor.x, state.cursor.y);
      await page.mouse.wheel(0, Number(action.dy) || 600);
      await page.waitForTimeout(400);
      label = `Scrolled ${Number(action.dy) > 0 ? "down" : "up"}`;
      break;
    default:
      label = "Took a screenshot";
  }
  const image = (await page.screenshot({ type: "jpeg", quality: 62 })).toString("base64");
  writeState(state);
  process.stdout.write(JSON.stringify({ image, cursor: state.cursor, url: page.url().replace("http://localhost:3000", "") || "/", title: await page.title().catch(() => ""), label, consoleErrors: errors.slice(0, 10) }));
} catch (err) {
  process.stdout.write(JSON.stringify({ error: String(err.message || err).slice(0, 500) }));
} finally {
  await browser.close().catch(() => {}); // disconnects CDP only; Chromium keeps running
}
