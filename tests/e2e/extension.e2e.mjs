/**
 * End-to-end test of the real Chrome extension against a running ContextOS API.
 *
 *   1. pnpm db:reset            (seeds Northstar)
 *   2. pnpm --filter @contextos/web build && pnpm --filter @contextos/web start
 *   3. pnpm test:e2e
 *
 * Gmail / LinkedIn / generic fixture pages are served on their real domains
 * via request interception, so the real adapters' detection runs. The overlay
 * is opened through the same code path as the keyboard shortcut (injecting
 * content.js), because synthetic key events cannot trigger browser commands.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const API = process.env.CONTEXTOS_API_URL ?? "http://localhost:3000";
const EXT = join(root, "apps", "extension", "dist");
const SHOTS = process.env.E2E_SCREENSHOTS ?? join(root, "tests", "e2e", "screenshots");
const EXECUTABLE = process.env.CHROMIUM_PATH || undefined;

// Headless Chromium mis-routes clicks into out-of-process iframes that were just
// repositioned, which real Chrome does not. Run headed under Xvfb when possible.
if (!process.env.DISPLAY && !process.env.E2E_HEADLESS && !process.env.__E2E_XVFB) {
  const hasXvfb = spawnSync("which", ["xvfb-run"]).status === 0;
  if (hasXvfb) {
    const child = spawnSync("xvfb-run", ["-a", process.execPath, fileURLToPath(import.meta.url)], {
      stdio: "inherit",
      env: { ...process.env, __E2E_XVFB: "1" },
    });
    process.exit(child.status ?? 1);
  }
}
const HEADLESS = Boolean(process.env.E2E_HEADLESS) || (!process.env.DISPLAY && !process.env.__E2E_XVFB);

const fixture = (name) => readFileSync(join(here, "fixtures", name), "utf8");
let failures = 0;
const check = (cond, message) => {
  if (cond) console.log(`  ✓ ${message}`);
  else {
    failures++;
    console.error(`  ✗ ${message}`);
  }
};

async function getToken() {
  const login = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "demo@northstar.test", password: "northstar-demo" }),
  });
  if (!login.ok) throw new Error(`Login failed (${login.status}). Is the API running and seeded?`);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const res = await fetch(`${API}/api/extension/token`, { method: "POST", headers: { cookie } });
  const { token } = await res.json();
  return { token, cookie };
}

async function overlayFrame(page) {
  for (let i = 0; i < 50; i++) {
    const frame = page.frames().find((f) => f.url().startsWith("chrome-extension://") && f.url().includes("overlay.html"));
    if (frame) return frame;
    await page.waitForTimeout(100);
  }
  throw new Error("Overlay frame did not appear");
}

async function openOverlay(sw, page) {
  const url = page.url();
  await sw.evaluate(async (pageUrl) => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((t) => t.url === pageUrl) ?? tabs[0];
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  }, url);
  return overlayFrame(page);
}

async function main() {
  execFileSync("node", [join(root, "apps", "extension", "build.mjs"), "--test"], { stdio: "inherit", env: { ...process.env, CONTEXTOS_API_URL: API } });
  mkdirSync(SHOTS, { recursive: true });
  const { token, cookie } = await getToken();

  const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "ctxos-e2e-")), {
    headless: HEADLESS,
    executablePath: EXECUTABLE,
    viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  await context.route("https://mail.google.com/**", (route) => route.fulfill({ contentType: "text/html", body: fixture("gmail.html") }));
  await context.route("https://www.linkedin.com/**", (route) => route.fulfill({ contentType: "text/html", body: fixture("linkedin.html") }));
  await context.route("https://example.org/**", (route) => route.fulfill({ contentType: "text/html", body: fixture("generic.html") }));

  let [sw] = context.serviceWorkers();
  sw ??= await context.waitForEvent("serviceworker");
  await sw.evaluate((t) => chrome.storage.local.set({ "contextos.token": t }), token);
  // Close the "connect" tab opened on install.
  for (const p of context.pages()) if (p.url().includes("/extension/connect")) await p.close();

  /* ---------------- Gmail: the core demo ---------------- */
  console.log("\nGmail demo");
  const gmail = await context.newPage();
  await gmail.goto("https://mail.google.com/mail/u/0/#inbox?compose=new");
  const draft = "Hi John, just wanted to follow up regarding our new platform. We really think you will love it!";
  await gmail.click("#body");
  await gmail.keyboard.type(draft);
  await gmail.evaluate(() => {
    const body = document.getElementById("body");
    const range = document.createRange();
    range.selectNodeContents(body);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });

  let overlay = await openOverlay(sw, gmail);
  await overlay.getByText("Rewrite in Brand Voice").waitFor({ timeout: 10_000 });
  const labels = await overlay.locator(".action .label").allInnerTexts();
  console.log("  actions:", labels.join(" | "));
  check(labels[0] === "Rewrite in Brand Voice", "first action is Rewrite in Brand Voice");
  check(labels.includes("Improve Conversion") && labels.includes("Shorten") && labels.includes("Create Follow-Up"), "Gmail actions recommended");
  check((await overlay.locator(".chip").allInnerTexts()).join(" ").includes("Gmail"), "context indicator shows Gmail");
  await gmail.screenshot({ path: join(SHOTS, "gmail-actions.png") });

  await overlay.getByText("Rewrite in Brand Voice").click();
  await overlay.locator("textarea.editor").waitFor({ timeout: 60_000 });
  const output = await overlay.locator("textarea.editor").inputValue();
  const using = await overlay.locator(".footer .ctx").allInnerTexts();
  console.log("  using:", using.join(" · "));
  check(output.length > 20, "result generated");
  check(using.includes("Marketing") && using.includes("Northstar") && using.includes("Brand Voice") && using.includes("Gmail Context"), "Using: Marketing · Northstar · Brand Voice · Gmail Context");
  await gmail.screenshot({ path: join(SHOTS, "gmail-result.png") });

  await overlay.getByRole("button", { name: /^Replace/ }).click();
  await gmail.waitForTimeout(500);
  const bodyText = await gmail.locator("#body").innerText();
  check(bodyText.replace(/\s+/g, " ").trim() === output.replace(/\s+/g, " ").trim(), "Gmail draft replaced with the result");
  check(!bodyText.includes("just wanted to"), "original selection removed");
  check(!gmail.frames().some((f) => f.url().includes("overlay.html")), "overlay closed after replace");
  await gmail.screenshot({ path: join(SHOTS, "gmail-replaced.png") });

  /* ---------------- LinkedIn ---------------- */
  console.log("\nLinkedIn");
  const linkedin = await context.newPage();
  await linkedin.goto("https://www.linkedin.com/feed/");
  await linkedin.click("#composer");
  overlay = await openOverlay(sw, linkedin);
  await overlay.getByText("Write Post").waitFor({ timeout: 10_000 });
  check(true, "empty composer recommends Write Post");
  await overlay.getByText("Write Post").click();
  await overlay.locator("textarea.editor").waitFor({ timeout: 60_000 });
  const post = await overlay.locator("textarea.editor").inputValue();
  await overlay.getByRole("button", { name: /^Insert/ }).click();
  await linkedin.waitForTimeout(400);
  const composer = await linkedin.locator("#composer").innerText();
  check(composer.replace(/\s+/g, " ").includes(post.split("\n")[0].trim().slice(0, 30)), "post inserted into LinkedIn composer");

  await linkedin.click("#comment");
  overlay = await openOverlay(sw, linkedin);
  await overlay.getByText("Generate Comments").waitFor({ timeout: 10_000 });
  check(true, "comment box recommends Generate Comments");
  await overlay.getByText("Generate Comments").click();
  await overlay.locator("textarea.editor").waitFor({ timeout: 60_000 });
  await overlay.getByRole("button", { name: "Inspect" }).click();
  const inspector = await overlay.locator(".inspector").innerText();
  check(inspector.includes("Recovery is the most underrated"), "comment action used the post text (inspectable)");
  await linkedin.screenshot({ path: join(SHOTS, "linkedin-comment.png") });
  await linkedin.keyboard.press("Escape").catch(() => undefined);

  /* ---------------- Generic textarea + contenteditable ---------------- */
  console.log("\nGeneric fields");
  const generic = await context.newPage();
  await generic.goto("https://example.org/form");
  await generic.fill("#bio", "We sell a really great band for sleep");
  await generic.click("#bio");
  await generic.evaluate(() => {
    const el = document.getElementById("bio");
    el.focus();
    el.setSelectionRange(0, el.value.length);
  });
  overlay = await openOverlay(sw, generic);
  await overlay.getByText("Shorten").waitFor({ timeout: 10_000 });
  await overlay.getByText("Shorten").click();
  await overlay.locator("textarea.editor").waitFor({ timeout: 60_000 });
  const shortened = await overlay.locator("textarea.editor").inputValue();
  await overlay.getByRole("button", { name: /^Replace/ }).click();
  await generic.waitForTimeout(300);
  check((await generic.inputValue("#bio")) === shortened, "textarea replaced");

  await generic.click("#rich");
  await generic.keyboard.type("Our product helps people sleep");
  await generic.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  overlay = await openOverlay(sw, generic);
  await overlay.getByText("Improve").first().waitFor({ timeout: 10_000 });
  await overlay.locator(".action", { hasText: "Improve" }).first().click();
  await overlay.locator("textarea.editor").waitFor({ timeout: 60_000 });
  const improved = await overlay.locator("textarea.editor").inputValue();
  await overlay.getByRole("button", { name: /^Replace/ }).click();
  await generic.waitForTimeout(300);
  const rich = await generic.locator("#rich").innerText();
  check(rich.replace(/\s+/g, " ").trim() === improved.replace(/\s+/g, " ").trim(), "contenteditable replaced");

  /* ---------------- History ---------------- */
  console.log("\nHistory");
  const history = await fetch(`${API}/history`, { headers: { cookie } }).then((r) => r.text());
  check(history.includes("Rewrite in Brand Voice") && history.includes("Gmail"), "actions appear in History");

  await context.close();
  console.log(failures ? `\n${failures} check(s) failed` : "\nAll e2e checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
