// Builds the ContextOS Chrome extension (Manifest V3) into ./dist.
//   node build.mjs            production build
//   node build.mjs --watch    rebuild on change
//   node build.mjs --test     adds host permissions used by the automated e2e test
import { context, build } from "esbuild";
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, "dist");
const watch = process.argv.includes("--watch");
const testBuild = process.argv.includes("--test");
const apiUrl = (process.env.CONTEXTOS_API_URL ?? "http://localhost:3000").replace(/\/$/, "");
const apiOrigin = new URL(apiUrl).origin;
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

/**
 * Permissions are deliberately minimal (see README → Extension permissions):
 *  - activeTab: access the current tab only after the user presses the shortcut / clicks the icon
 *  - scripting: inject the content script into that tab on demand (no always-on content scripts)
 *  - storage:   keep the API token locally
 *  - clipboardWrite: reliable "Copy" from the overlay
 *  - host_permissions: only the ContextOS API origin
 */
const manifest = {
  manifest_version: 3,
  name: "ContextOS",
  short_name: "ContextOS",
  version: pkg.version,
  description: "Specialized, company-aware AI inside the apps you already use.",
  minimum_chrome_version: "116",
  icons: { 16: "icons/icon-16.png", 32: "icons/icon-32.png", 48: "icons/icon-48.png", 128: "icons/icon-128.png" },
  action: { default_popup: "popup.html", default_title: "ContextOS", default_icon: { 16: "icons/icon-16.png", 32: "icons/icon-32.png" } },
  background: { service_worker: "background.js" },
  permissions: ["activeTab", "scripting", "storage", "clipboardWrite"],
  host_permissions: [`${apiOrigin}/*`],
  commands: {
    "toggle-overlay": {
      suggested_key: { default: "Ctrl+Shift+K", mac: "Command+Shift+K" },
      description: "Open ContextOS",
    },
  },
  externally_connectable: { matches: [`${apiOrigin}/*`] },
  web_accessible_resources: [{ resources: ["overlay.html", "overlay.js", "overlay.css"], matches: ["<all_urls>"] }],
};

if (testBuild) {
  // The e2e test drives the overlay without a real keyboard shortcut, so it needs
  // to inject into its fixture pages directly.
  manifest.host_permissions.push("https://mail.google.com/*", "https://www.linkedin.com/*", "https://example.org/*");
}

const shared = {
  bundle: true,
  format: "iife",
  target: "chrome116",
  sourcemap: watch ? "inline" : false,
  minify: !watch,
  legalComments: "none",
  define: {
    __CONTEXTOS_API_URL__: JSON.stringify(apiUrl),
    "process.env.NODE_ENV": JSON.stringify(watch ? "development" : "production"),
  },
  logLevel: "info",
};

const entries = [
  { in: "src/background.ts", out: "background" },
  { in: "src/content/index.ts", out: "content" },
  { in: "src/overlay/main.tsx", out: "overlay" },
  { in: "src/popup/main.tsx", out: "popup" },
];

function copyStatic() {
  mkdirSync(dist, { recursive: true });
  cpSync(join(root, "static"), dist, { recursive: true });
  writeFileSync(join(dist, "manifest.json"), JSON.stringify(manifest, null, 2));
}

rmSync(dist, { recursive: true, force: true });
copyStatic();
const options = {
  ...shared,
  entryPoints: entries.map((e) => ({ in: join(root, e.in), out: e.out })),
  outdir: dist,
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log(`Watching… API: ${apiUrl}`);
} else {
  await build(options);
  console.log(`Built extension → ${dist} (API: ${apiUrl}${testBuild ? ", test permissions" : ""})`);
}
