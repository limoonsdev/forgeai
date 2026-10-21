import { expect, test } from "@playwright/test";

const unique = Date.now().toString(36);
const email = `e2e-${unique}@example.com`;
const password = "e2e-password-123";

test.describe.configure({ mode: "serial" });

test("landing page renders the hero and prompt box", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Forge");
  await expect(page.getByLabel("Describe the app you want to build")).toBeVisible();
  await expect(page.getByText("Give $5, get $5.")).toBeVisible();
});

test("sign up, forge an app, answer the agent's poll and share the session", async ({ page, browser }) => {
  await page.goto("/signup");
  await page.fill("#name", "E2E Tester");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByTestId("credits-pill")).toContainText("$1.00");

  // Pick the offline demo model and start a project. The "?" makes the demo agent ask a poll first.
  await page.getByTestId("model-picker").click();
  await page.locator("[data-radix-popper-content-wrapper]").getByRole("button", { name: /Forged Demo/ }).click();
  await page.getByTestId("composer-input").fill("Build a landing page for a bakery called Golden Crust. Ask me the style?");
  await page.getByTestId("send-button").click();
  await page.waitForURL("**/project/**");

  const poll = page.getByTestId("poll-card");
  await expect(poll).toBeVisible({ timeout: 60_000 });
  await poll.getByText("Nature green").click();
  await page.getByTestId("poll-submit").click();

  await expect(page.getByText("I forged").first()).toBeVisible({ timeout: 180_000 });
  await expect(page.getByTestId("project-name")).toHaveText("Golden Crust");
  await expect(page.getByTestId("tool-row").filter({ hasText: "Wrote app/page.tsx" })).toBeVisible();

  // Credits were spent.
  const credits = await page.getByTestId("credits-pill").textContent();
  expect(credits).not.toBe("$1.00");

  // Share the session publicly and open it logged out.
  await page.getByTestId("share-button").click();
  await page.getByTestId("share-toggle").click();
  const url = await page.getByTestId("share-url").inputValue();
  expect(url).toContain("/share/");
  const anon = await browser.newContext();
  const viewer = await anon.newPage();
  await viewer.goto(url);
  await expect(viewer.getByText("Shared build session")).toBeVisible();
  await expect(viewer.getByTestId("remix-button")).toBeVisible();
  await anon.close();
});

test("REST API works with an API key", async ({ page, request }) => {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/dashboard");

  await page.goto("/settings/api-keys");
  await page.getByTestId("new-api-key").click();
  await page.getByPlaceholder("e.g. CI pipeline").fill("e2e");
  await page.getByRole("button", { name: "Create key" }).click();
  const key = await page.getByTestId("api-key-value").inputValue();
  expect(key).toMatch(/^fg_live_/);

  const me = await request.get("/api/v1/me", { headers: { Authorization: `Bearer ${key}` } });
  expect(me.ok()).toBeTruthy();
  expect((await me.json()).email).toBe(email);

  const projects = await request.get("/api/v1/projects", { headers: { Authorization: `Bearer ${key}` } });
  expect((await projects.json()).projects.length).toBeGreaterThan(0);

  const denied = await request.get("/api/v1/me", { headers: { Authorization: "Bearer fg_live_invalid" } });
  expect(denied.status()).toBe(401);
});
