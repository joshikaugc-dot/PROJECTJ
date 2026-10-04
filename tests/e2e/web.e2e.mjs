/**
 * Web app e2e: sign up → onboarding (organization, role, verticals, marketing
 * setup) → dashboard → Company Brain edit → playground run → History.
 * Requires the web app running at CONTEXTOS_API_URL (default http://localhost:3000).
 */
import { chromium } from "playwright";

const API = process.env.CONTEXTOS_API_URL ?? "http://localhost:3000";
let failures = 0;
const check = (cond, message) => {
  if (cond) console.log(`  ✓ ${message}`);
  else {
    failures++;
    console.error(`  ✗ ${message}`);
  }
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const email = `e2e-${Date.now()}@acme.test`;

try {
  console.log("\nSign up + onboarding");
  await page.goto(`${API}/signup`);
  await page.fill("#name", "Jordan Lee");
  await page.fill("#email", email);
  await page.fill("#password", "correct-horse-battery");
  await page.click("button[type=submit]");
  await page.waitForURL("**/onboarding");
  check(true, "account created → onboarding");

  await page.getByRole("button", { name: /Continue/ }).click();
  await page.fill("#org-name", "Acme Fitness");
  await page.fill("#org-web", "https://acme.example");
  await page.fill("#org-ind", "Fitness equipment");
  await page.fill("#org-desc", "Smart rowing machines for home workouts.");
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByRole("button", { name: "Growth Marketer" }).click();
  await page.getByRole("button", { name: /Continue/ }).click();
  check(await page.getByText("Coming soon").first().isVisible(), "future verticals shown as Coming soon");
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.fill("#s-prod", "Acme Rower — A connected rowing machine with live classes.");
  await page.fill("#s-aud", "Home fitness enthusiasts");
  await page.fill("#s-voice", "Energetic, Direct, Encouraging");
  await page.fill("#s-comp", "Hydrow, Peloton");
  await page.fill("#s-goals", "Grow trial sign-ups");
  await page.getByRole("button", { name: /Finish setup/ }).click();
  await page.getByText("Install the Chrome extension").waitFor();
  check(true, "organization + Company Brain created; extension step shown");
  await page.getByRole("button", { name: /Go to dashboard/ }).click();
  await page.waitForURL("**/home");
  check((await page.locator("aside").innerText()).includes("Acme Fitness"), "dashboard shows the new organization");

  console.log("\nCompany Brain");
  await page.goto(`${API}/brain`);
  await page.getByRole("button", { name: /^Brand/ }).click();
  const tagline = page.getByLabel("Tagline");
  await tagline.fill("Row smarter.");
  await page.getByRole("button", { name: "Save brand" }).click();
  await page.getByText("Saved").waitFor();
  await page.reload();
  await page.getByRole("button", { name: /^Brand/ }).click();
  check((await page.getByLabel("Tagline").inputValue()) === "Row smarter.", "brand edit persisted");

  console.log("\nVerticals");
  await page.goto(`${API}/verticals`);
  check((await page.locator("main").innerText()).includes("Enabled"), "Marketing enabled");

  console.log("\nPlayground → History");
  await page.goto(`${API}/home`);
  await page.getByRole("button", { name: /Rewrite in Brand Voice/ }).click();
  await page.getByText("Using").first().waitFor();
  await page.getByText("Acme Fitness", { exact: true }).first().waitFor();
  check(true, "playground ran with the new company context");
  await page.goto(`${API}/history`);
  check((await page.locator("table").innerText()).includes("Rewrite in Brand Voice"), "action recorded in History");

  console.log("\nPrivacy: history off");
  await page.goto(`${API}/settings`);
  await page.getByRole("switch", { name: "Save history" }).click();
  await page.waitForTimeout(300);
  await page.goto(`${API}/home`);
  await page.getByRole("button", { name: /Shorten/ }).click();
  await page.getByText("Using").first().waitFor();
  await page.waitForTimeout(300);
  await page.goto(`${API}/history`);
  check(!(await page.locator("table").innerText()).includes("Shorten"), "nothing stored when history is disabled");

  check(errors.length === 0, `no client errors${errors.length ? `: ${errors.join("; ")}` : ""}`);
} catch (error) {
  failures++;
  console.error(error);
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} check(s) failed` : "\nAll web e2e checks passed");
process.exit(failures ? 1 : 0);
