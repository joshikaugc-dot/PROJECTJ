# ContextOS

**Specialized AI that follows you across your workflow.**

General-purpose AI tools are powerful, but every session starts as a blank box: you explain your company, your role and your task, paste text in, and copy the result back out. ContextOS removes that loop. It already knows who you are, what your company does, which app you're in and what you selected, and it brings the right specialized skill into the app you're using.

> General AI knows a lot. ContextOS knows who you are, what your company does, what you're working on, which application you're using, and how professionals in your field should complete that task.

**Marketing is the first vertical.** The platform underneath is vertical-agnostic: Sales, Recruiting, Finance and the rest plug in as definitions without platform changes (see [How to add the Sales vertical](#tutorial-how-to-add-the-sales-vertical)).

> "ContextOS" is a temporary name. It lives in one constant, `PRODUCT` in [`packages/shared/src/product.ts`](packages/shared/src/product.ts). The extension's manifest name is set in [`apps/extension/build.mjs`](apps/extension/build.mjs).

---

## Contents

- [The demo](#the-demo)
- [Architecture](#architecture)
- [Monorepo structure](#monorepo-structure)
- [Chrome extension architecture](#chrome-extension-architecture)
- [Context system](#context-system)
- [Vertical architecture](#vertical-architecture)
- [Skill architecture](#skill-architecture)
- [Workflow architecture](#workflow-architecture)
- [AI provider abstraction and routing](#ai-provider-abstraction-and-routing)
- [Execution layer](#execution-layer)
- [How the Marketing vertical works](#how-the-marketing-vertical-works)
- [Tutorial: How to add the Sales vertical](#tutorial-how-to-add-the-sales-vertical)
- [How to create a new skill](#how-to-create-a-new-skill)
- [How to create a new app adapter](#how-to-create-a-new-app-adapter)
- [Privacy](#privacy)
- [Extension permissions](#extension-permissions)
- [Setup](#setup)
- [Environment variables](#environment-variables)
- [Database](#database)
- [Development workflow and testing](#development-workflow-and-testing)
- [Authentication](#authentication)
- [Future: desktop apps](#future-desktop-apps)
- [Future: marketplace](#future-marketplace)
- [Known limitations](#known-limitations)

---

## The demo

1. Sign in as the seeded demo user (`demo@northstar.test` / `northstar-demo`). The **Northstar** company brain is already loaded: a consumer wellness company that sells the Northstar Band, with a confident, minimal, evidence-oriented and never salesy brand voice, competing with WHOOP, Oura and Garmin.
2. The **Marketing** vertical is enabled.
3. In Gmail, write a draft (for example *"Hi John, just wanted to follow up regarding our new platform…"*) and highlight it.
4. Press **⌘⇧K** (macOS) or **Ctrl+Shift+K** (Windows/Linux).
5. ContextOS opens next to the selection and recommends **Rewrite in Brand Voice · Improve Conversion · Shorten · Create Follow-Up · Generate Subject Lines · Make More Persuasive**.
6. Choose **Rewrite in Brand Voice**. The footer shows **Using: Marketing · Northstar · Brand Voice · Gmail Context**, and **Inspect** shows exactly what was sent and why.
7. Click **Replace** (or press ⌘↵). The Gmail draft is replaced in place, and the action is saved to **History**.

The same flow works on LinkedIn (post composer, comments, messages) and in any textarea, input or rich-text field. Without an AI key, an offline **demo model** answers so you can still click through the flow; the UI labels those results clearly.

You can also try it without the extension: the dashboard's **Home → Try ContextOS** playground calls the same API with a simulated app context.

---

## Architecture

```
 ┌─────────────────────────────── Client surfaces ───────────────────────────────┐
 │ Chrome extension (today)      Web dashboard          macOS / Windows (future)  │
 │   App adapters → AppContext   Playground             Accessibility adapters    │
 │   Overlay UI  → Execution     Company Brain, History  → same AppContext         │
 └──────────────────────────────────────┬─────────────────────────────────────────┘
                                        │  /api/v1 (bootstrap · recommendations · run · actions)
 ┌──────────────────────────────────────▼─────────────────────────────────────────┐
 │ Orchestrator (apps/web/lib/server/orchestrator.ts): the only place layers meet │
 │                                                                                │
 │ 1 App Context ─▶ 2 Company/User Context ─▶ 3 Vertical ─▶ 4 Workflow ─▶ 5 Model │
 │   AppContext      ContextEngine selects     registry,      step engine    router│
 │   from adapter    only relevant blocks      skills,        (single- or    by    │
 │                                             actions        multi-step)    task  │
 └──────────────────────────────────────┬─────────────────────────────────────────┘
                                        │ result + context used + allowed actions
                         6 Execution layer (client): replace · insert · copy
                         (future: Gmail drafts, HubSpot activities, Docs, CRM)
```

There are six layers, each in its own package:

| Layer | Package | Responsibility |
|---|---|---|
| 1. App context | `@contextos/context-adapters` | Read where the user is: app, surface, selection, field, small metadata. Write text back. |
| 2. Company/personal context | `@contextos/context` (+ `@contextos/database`) | Store the Company Brain and the user profile; choose only what is relevant for each request. |
| 3. Verticals | `@contextos/verticals` | Plugin-like verticals that bundle a persona, skills, workflows and recommended actions. |
| 4. Workflows | `@contextos/workflows` | Run skills as sequences of small reusable steps. |
| 5. AI models | `@contextos/ai` | Provider-neutral `generate()`, routing by task type, structured output, failover. |
| 6. Execution | `@contextos/execution` | Apply results through executors (text today; app APIs later). |

The guiding rule: **the core never names a vertical or an app.** The orchestrator resolves the active vertical from the registry, asks it for a skill, builds context from the skill's declared needs, runs the skill's workflow through the router, and returns whatever actions the skill allows.

---

## Monorepo structure

pnpm workspaces + Turborepo. Internal packages ship TypeScript source; Next.js and esbuild compile it.

```
apps/
  web/                     Next.js 15 (App Router): dashboard, auth, onboarding, API (/api, /api/v1)
    app/(app)/             Home, Company Brain, Verticals, Workflows, History, Integrations, AI Models, Settings
    app/api/v1/            Client API used by the extension (bootstrap, recommendations, run, actions)
    lib/server/            orchestrator, auth/session, platform singletons, errors
  extension/               Chrome MV3 extension (esbuild, React overlay)
    src/background.ts      shortcut → on-demand injection; token handoff from the web app
    src/content/           thin content script: adapter snapshot, isolated overlay frame, executor
    src/overlay/           overlay UI (extension page rendered in an iframe)
    src/popup/             toolbar popup (status, connect, open on page)
packages/
  shared/                  product name, AppContext, API contract, Company Brain schemas (zod-free `client` entry)
  ai/                      types, router, providers/{anthropic,openai,gemini,demo}
  context/                 context engine + knowledge retriever (rule-based now; embeddings later)
  context-adapters/        base, generic, gmail, linkedin, google-docs, notion, hubspot adapters
  verticals/               core/ (types, registry, recommendations, prompt, execute)
                           marketing/ (skills, actions, workflows) · sales/ · finance/ · recruiting/ · _coming-soon/
  workflows/               workflow engine + step builders
  execution/               executor interface, registry, web-text + clipboard executors
  database/                Prisma schema, client, context store, Company Brain repo, Northstar seed
  ui/                      shadcn-style components (Button, Card, Input, Badge, Switch, Kbd)
tests/e2e/                 Playwright e2e for the extension (Gmail/LinkedIn/generic) and the web app
```

---

## Chrome extension architecture

```
 keyboard shortcut (chrome.commands)          toolbar popup "Open on this page"
            │                                              │
            ▼                                              ▼
   background.ts ── chrome.scripting.executeScript(content.js) on the active tab only
                                      │
                                      ▼
   content.js (in the page, isolated world, ~18 KB)
     1. detectAdapter(url) → GmailAdapter | LinkedInAdapter | … | GenericWebAdapter
     2. snapshot = adapter.captureSnapshot()  (focused field, selection range, anchor rect)
     3. appContext = adapter.getContext(snapshot)
     4. mounts <iframe src="overlay.html#nonce"> inside a CLOSED shadow root
     5. private MessageChannel ⇄ overlay (nonce-checked)
     6. on "execute": ExecutorRegistry → WebTextExecutor → adapter.replaceSelection / insertText
                                      │
                                      ▼
   overlay.html (extension page, React)
     • calls the API directly with the stored token (host permission for the API only)
     • recommendations, Ask, result editor, refine, regenerate, context inspector
     • Replace / Insert are delegated to the content script; Copy happens in the frame
```

Key decisions:

- **Nothing runs on pages until you invoke it.** There are no declared `content_scripts`. The shortcut grants `activeTab` for that tab, and the background injects `content.js` then. Re-pressing the shortcut toggles the overlay.
- **The overlay is an extension iframe, not page DOM.** Keystrokes typed into it never reach the host page (so Gmail's single-key shortcuts don't fire), page CSS can't restyle it, and the API token never enters the page's process or the content script. The frame sits in a closed shadow root and only accepts a `MessagePort` that carries a per-open nonce from its URL hash, which the page can't read.
- **Selection is snapshotted before the overlay takes focus.** Adapters store the live `Range` (contenteditable) or selection offsets (textarea/input) and restore them before writing. If the range was invalidated they fall back to locating the selected text.
- **Writes go through `document.execCommand('insertText')` first.** It keeps the editor's undo stack and works with Gmail, LinkedIn's Quill editor, Notion and React-controlled fields. The adapter verifies the text landed, then falls back to direct DOM/value edits that dispatch `input` events.
- **Authentication:** the popup's **Connect** opens `/extension/connect?ext=<id>` in the web app. That page mints an API token from the signed-in session and hands it to the extension via `externally_connectable` (`chrome.runtime.sendMessage(extId, …)`), restricted to the API origin. If messaging isn't available, the page shows the token to paste into the popup.
- **Shortcut:** `Command+Shift+K` on macOS, `Ctrl+Shift+K` elsewhere. You can change it at `chrome://extensions/shortcuts` (the popup links there).

---

## Context system

### App context (where you are)

```ts
interface AppContext {
  appId: string;            // "gmail" | "linkedin" | "google-docs" | "notion" | "hubspot" | "generic" | …
  appName: string;          // "Gmail"
  domain: string; pageTitle: string; pageUrl: string;  // URL is origin+path only; emails in titles are redacted
  selectedText?: string;
  fieldValue?: string;      // focused field content (capped)
  nearbyText?: string;      // e.g. the email thread; only sent when an action needs it or you opt in
  activeElementType: "textarea" | "input" | "contenteditable" | "document" | "none";
  surface?: string;         // "email-compose" | "email-reply" | "post-composer" | "comment" | "message" | "document" | …
  metadata: Record<string, string | number | boolean>;  // e.g. emailSubject, recipients (names only)
}
```

### Company and user context (who you are)

The **Company Brain** (company, products, customers, brand, competitors, goals, documents) and the **user profile** (role, department, seniority, responsibilities, writing preferences, preferred model, enabled verticals) are stored per organization and user.

### Choosing only what is relevant

`ContextEngine.getRelevantContext({ organizationId, userId, vertical, task, appContext })` loads data through a `ContextStore` interface (Prisma implementation in `@contextos/database`) and runs `selectRelevantContext`, a pure function:

- Each skill declares `requiredContext` and `optionalContext` (`brand.voice`, `customers`, `products`, `competitors`, `goals`, `documents`, `campaigns`, `app.nearby`, …).
- Required keys are included. Optional keys are included only when they are relevant: a competitor or product **named in your text**, goals **scoped to the active vertical**, documents that **match the task** via the `KnowledgeRetriever`.
- Surrounding page text is included only if the action needs it or you opted in.
- A character budget drops the lowest-priority blocks first.
- Every block carries a **reason** ("Mentioned in your text", "Keeps output on-brand"). That reason powers the **Using:** indicator and the **Inspect** panel in both the overlay and History.

The retriever is an interface. `KeywordRetriever` ships today. An `EmbeddingRetriever` (pgvector), a RAG pipeline or a knowledge graph can replace it without touching callers.

---

## Vertical architecture

A vertical is data plus functions, registered with the `VerticalRegistry`:

```ts
interface VerticalDefinition {
  id: string; name: string; description: string; version: string;
  status: "available" | "coming-soon";
  systemPrompt: string;                 // the vertical's persona
  skills: SkillDefinition[];            // what it can do
  workflows: WorkflowDefinition[];      // multi-step processes
  recommendedActions: ActionDefinition[]; // what the overlay suggests, with targeting rules
  supportedContexts?: string[]; suggestedRoles?: string[]; plannedSkills?: string[];
  askPlaceholder?: string; askSkillId?: string;
}
```

- **Registry** ([`core/registry.ts`](packages/verticals/src/core/registry.ts)): validates a vertical (every action points at a real skill, ids are unique, JSON skills can render) and resolves the active vertical from what the user enabled.
- **Recommendations** ([`core/recommendations.ts`](packages/verticals/src/core/recommendations.ts)): `getRecommendedActions({ vertical, appContext, userContext })` scores actions using priority, app match, surface match, whether there is a selection, editability and role keywords. App-tuned actions can `supersede` generic ones, so in Gmail "Improve Conversion" replaces the generic "Improve".
- **Database:** verticals share one schema. `Vertical` is the catalog row, synced from code. `OrganizationVertical` installs a vertical for an org, with a JSON `settings` column for vertical-specific config. `UserVertical` lets each person choose the verticals they use. Vertical-scoped data such as goals and documents uses a nullable `verticalId`, never per-vertical tables.
- **Multiple verticals:** if a user enables several (for example a founder using Marketing, Sales and Finance), the overlay's vertical chip becomes a switcher. The API takes `verticalId` on every call.

---

## Skill architecture

```ts
interface SkillDefinition<TOutput> {
  id; name; description;
  inputSchema;                      // zod; default { text, instruction?, options, nearbyText? }
  outputSchema; output: "text" | "json";
  systemInstructions: string;       // appended to platform + vertical prompts
  requiredContext: ContextKey[]; optionalContext?: ContextKey[];
  preferredModel: { taskType: "fast-rewrite" | "writing" | "reasoning" | "research" | "structured"; provider? };
  allowedActions: ("replace" | "insert" | "copy")[];
  requiresText: boolean;
  buildPrompt(input, ctx): string;  // task-specific prompt
  render?(output): string;          // JSON → insertable text
  extras?(output): { label, value }[];  // e.g. email subject shown separately
  workflow?: WorkflowDefinition;    // multi-step override
}
```

The prompt is assembled in layers ([`core/prompt.ts`](packages/verticals/src/core/prompt.ts)):

1. **Platform rules:** return only the deliverable, never invent facts, preserve names and dates.
2. **Vertical persona:** for example the senior marketer.
3. **Skill instructions.**
4. **Role guidance:** "The user is a Head of Marketing…".
5. **App format rules:** plain-text email for Gmail, no markdown on LinkedIn, and so on.

The user message carries `<context>` (selected blocks) and the skill prompt, with the working text in `<text>` tags. **Actions** are thin, app-aware entry points into skills that pass `options` (for example `improve-copy` with `{ focus: "conversion" }`). One skill backs many actions.

---

## Workflow architecture

Every skill runs through the workflow engine ([`packages/workflows`](packages/workflows/src/workflow-engine.ts)). Skills without a `workflow` get a one-step "generate" workflow, so single-shot and multi-step skills share one execution path, one trace format and one runtime.

```ts
const campaignBriefWorkflow: WorkflowDefinition<SkillInput, CampaignBrief> = {
  steps: [
    transformStep("load-company-context", …),
    transformStep("load-vertical-context", …),
    objectStep({ id: "goal",        name: "Analyze goal",                  schema: goalSchema, … }),
    objectStep({ id: "audience",    name: "Identify target customer",      … }),
    objectStep({ id: "positioning", name: "Determine positioning",         … }),
    objectStep({ id: "message",     name: "Generate message",              … }),
    objectStep({ id: "channels",    name: "Create channel recommendations",… }),
    transformStep("assemble", "Return structured campaign", …),
  ],
  output: (state) => state.results.assemble,
};
```

Each generation step sees the context plus earlier steps' structured results (`priorResults`). Steps call a `WorkflowRuntime` (`generateText` / `generateObject`) supplied by the host. Workflows never import a provider or a database. The step trace is returned to clients and shown on the Workflows page.

---

## AI provider abstraction and routing

```ts
router.generate({ messages, systemPrompt, schema?, taskType, preferredProvider?: "auto" | "anthropic" | "openai" | "gemini" })
router.generateObject(request, zodSchema)   // JSON Schema prompt → parse → validate → one corrective retry
```

- Providers implement `AIProvider { id, models: { fast, balanced, powerful }, isConfigured(), generate() }`. Anthropic (Messages API), OpenAI (Chat Completions) and Gemini (generateContent) are implemented over plain REST with `fetch`, so there are no SDK lock-ins and no vendor-shaped types leak out.
- **Routing:** `DEFAULT_ROUTING` maps task types to ordered `{ provider, tier }` candidates. For example, writing → Claude Sonnet, reasoning → the most powerful tier, fast-rewrite → the fast tier, research → Gemini first. A user preference (AI Models page) goes first. Retryable errors (429/5xx/network) fail over to the next configured provider; auth and validation errors surface immediately.
- **Defaults:** Anthropic is primary (`claude-haiku-4-5`, `claude-sonnet-5-5`, `claude-opus-5-5`). Every model id can be overridden per tier with environment variables.
- **Demo model:** with no keys configured, the deterministic `DemoProvider` answers so the product and tests run offline. It is not a language model; results are labeled "Demo model" everywhere. Set `CONTEXTOS_DISABLE_DEMO_MODEL=true` to forbid it.

Adding a provider means implementing `AIProvider` and registering it in [`factory.ts`](packages/ai/src/factory.ts).

---

## Execution layer

`ActionExecutor { id, handles: ExecutionType[], canExecute(req), execute(req) }` with an `ExecutorRegistry` that dispatches by type. Today:

- `WebTextExecutor`: `replace` and `insert`, through the adapter that captured the selection.
- `ClipboardExecutor`: `copy`.

Execution types are namespaced strings (`"gmail.create-draft"`, `"hubspot.log-activity"`, `"notion.create-page"`), so future executors register alongside without changing callers. Clients report what was applied (`POST /api/v1/actions/:id`), and History shows it.

---

## How the Marketing vertical works

[`packages/verticals/src/marketing`](packages/verticals/src/marketing):

| Skill | What it does | Context | Task type |
|---|---|---|---|
| Rewrite in Brand Voice | Same message, unmistakably on-brand | brand voice, audience (+products, positioning, preferences) | writing |
| Improve Copy | Clarity, persuasion, specificity, CTA. Options: `conversion`, `persuasion`, `hook`, `clarity` | brand voice (+audience, products, goals) | writing |
| Shorten | 40–60% shorter. Option `summary` | (+brand voice) | fast-rewrite |
| Expand | Stronger, fuller copy. Option `continue` | brand voice, products | writing |
| Email Generator | `{ subject, previewText, body, cta }`, with subject/preview shown as extras | brand, products, audience | writing (JSON) |
| Subject Lines | 5 distinct subject lines | brand, audience | fast-rewrite (JSON) |
| Follow-Up Generator | Uses the thread to add value, not "just checking in" | brand voice, **email thread** | writing |
| Social Content | LinkedIn / Instagram / X; thought-leadership style; comment replies | brand, audience | writing |
| Campaign Ideas | 8-step campaign brief workflow | company, products, audience, brand, positioning, goals | structured |
| Content Ideas | Ideas tied to product, audience and goals | company, products, audience, goals | structured |
| Competitor Analysis | Where each side wins, plus counter-messaging | competitors, positioning, products | reasoning |
| Positioning | Statement, value proposition, supporting messages | products, audience, competitors | reasoning |
| Ask Marketing AI | Free-form, with any relevant context | brand, audience (+everything relevant) | writing |

Actions are tuned per app ([`marketing/actions.ts`](packages/verticals/src/marketing/actions.ts)):

- **Gmail:** Rewrite in Brand Voice, Improve Conversion, Shorten, Create Follow-Up, Generate Subject Lines, Make More Persuasive. With an empty draft: Draft Email.
- **LinkedIn:** Write Post (empty composer), Improve Hook, Rewrite in Brand Voice, Thought-Leadership Version, Generate Comments (uses the post you're commenting on).
- **Google Docs / Notion:** Improve Section, Continue Writing, Create Campaign Brief, Summarize, Rewrite in Brand Voice.
- **Anywhere:** Rewrite, Improve, Shorten, Expand, Turn into Social Post, Campaign Ideas, Content Ideas, Competitor Analysis.

---

## Tutorial: How to add the Sales vertical

The repo already contains a Sales vertical in [`packages/verticals/src/sales`](packages/verticals/src/sales) with one working skill (`cold-outreach`) and status `coming-soon`. Shipping it requires **no changes to the platform, the extension, the API or the database schema.**

### 1. Write skills

```ts
// packages/verticals/src/sales/skills/objection-handling.ts
import { defineSkill, textOutput } from "../../core/define";
import { instructionBlock, textBlock } from "../../core/prompt";

export const objectionHandling = defineSkill<string>({
  id: "objection-handling",
  name: "Handle Objection",
  description: "Responds to a prospect's objection with empathy and proof.",
  output: "text",
  outputSchema: textOutput,
  systemInstructions: `Acknowledge the concern, reframe with one relevant proof point from the context, and propose a next step. Never disparage competitors.`,
  requiredContext: ["products", "customers", "brand.voice"],
  optionalContext: ["competitors", "app.nearby", "documents"],
  preferredModel: { taskType: "writing" },
  allowedActions: ["replace", "insert", "copy"],
  requiresText: true,
  buildPrompt: (input) => `Respond to this objection:\n${textBlock(input.text)}${instructionBlock(input.instruction)}`,
});
```

The skill doesn't know about Gmail, Prisma or Anthropic. It declares what it needs.

### 2. Declare actions with targeting rules

```ts
// packages/verticals/src/sales/index.ts
export const salesVertical = defineVertical({
  id: "sales",
  name: "Sales",
  status: "available",                       // ← was "coming-soon"
  systemPrompt: `You are the Sales intelligence inside ContextOS…`,
  skills: [coldOutreach, objectionHandling],
  workflows: [],
  recommendedActions: [
    { id: "cold-outreach", label: "Write Cold Outreach", skillId: "cold-outreach", priority: 90, appliesTo: { apps: ["gmail", "linkedin"] }, onlyWithoutText: true },
    { id: "handle-objection", label: "Handle Objection", skillId: "objection-handling", priority: 95, requiresText: true, appliesTo: { apps: ["gmail"], surfaces: ["email-reply"] }, usesPageContext: true },
  ],
  askPlaceholder: "Ask Sales AI…",
  askSkillId: "cold-outreach",
  // …description, version, suggestedRoles
});
```

### 3. It's already registered

`BUILT_IN_VERTICALS` in [`packages/verticals/src/index.ts`](packages/verticals/src/index.ts) includes `salesVertical`. The Verticals page lists every registered vertical straight from the registry and shows an enable toggle for available ones. The `Vertical` catalog row is written by the seed and by the web app before a vertical is enabled (`ensureVerticalCatalog`). For a brand-new vertical, add it to `BUILT_IN_VERTICALS`.

### 4. Enable it

In **Verticals**, toggle Sales on. That writes an `OrganizationVertical` and a `UserVertical` row. Now in Gmail:

- If your active vertical is **Marketing**, you see Marketing actions.
- If it is **Sales**, you see Sales actions.
- With both enabled, the overlay header's vertical chip becomes a switcher.

Same extension, same API, same context engine. Only the definitions changed.

### 5. Optional: vertical-specific data

Store vertical settings (for example a sales methodology) in `OrganizationVertical.settings`, and vertical-scoped goals or documents with `verticalId: "sales"`. The context engine already scopes goals and documents to the active vertical.

### 6. Test it

[`registry.test.ts`](packages/verticals/src/core/registry.test.ts) contains *"activates a new vertical without any platform change"*, which registers Sales as available and checks that Gmail recommendations come from Sales.

---

## How to create a new skill

1. Create `packages/verticals/src/<vertical>/skills/<skill>.ts` with `defineSkill(...)`. Choose `requiredContext` carefully: it decides what leaves the database.
2. For structured output, set `output: "json"`, give a zod `outputSchema` and a `render()`. Optionally add `extras()`.
3. For multi-step logic, write a `WorkflowDefinition` using `transformStep` / `textStep` / `objectStep`, and set `workflow` on the skill.
4. Add it to the vertical's `skills`, then expose it through one or more `recommendedActions` (with `appliesTo`, `requiresText`, `options`, `supersedes`, `roles`).
5. Add a test next to [`execute.test.ts`](packages/verticals/src/core/execute.test.ts) with a recording runtime to assert the prompt contains what you expect.

## How to create a new app adapter

1. Create `packages/context-adapters/src/<app>-adapter.ts`, extending `BaseAdapter`:

```ts
export class FigmaAdapter extends BaseAdapter {
  readonly id = "figma";
  readonly name = "Figma";
  detect(url: URL) { return url.hostname === "www.figma.com"; }
  protected override getSurface(s: SelectionSnapshot) { return s.element?.closest(".comment-editor") ? "comment" : super.getSurface(s); }
  protected override getMetadata(s: SelectionSnapshot) { return { fileName: s.pageDoc.title.replace(/ – Figma$/, "") }; }
  protected override getNearbyText(s: SelectionSnapshot) { /* the comment thread, capped */ return undefined; }
}
```

2. `BaseAdapter` already handles textareas, inputs and contenteditable editors: snapshot, restore and `execCommand` with verification and fallbacks. Override `captureSnapshot`, `insertText` or `replaceSelection` only for unusual editors, as [`google-docs-adapter.ts`](packages/context-adapters/src/google-docs-adapter.ts) does.
3. Register it in [`registry.ts`](packages/context-adapters/src/registry.ts) before `GenericWebAdapter`.
4. Keep selectors in one exported constant, like `GMAIL_SELECTORS`, so UI changes are one-line fixes.
5. Optionally tune actions for the new `appId` and `surface` in a vertical. No product logic belongs in the adapter.

---

## Privacy

ContextOS reads text you are working on, so the defaults are conservative:

- **Nothing runs on a page until you press the shortcut** or click "Open on this page". There are no persistent content scripts.
- **Minimal capture:** the selection, the focused field's content (capped), the app, the page title (email addresses redacted) and the URL **without query string or fragment**. Gmail recipient metadata uses display names only. Whole pages are never captured.
- **Surrounding text** (an email thread, a LinkedIn post) is captured locally but **only sent** when the chosen action needs it (Create Follow-Up, Generate Comments) or you turn on "Include email thread / page context". Recommendation requests never include it.
- **The context sent to the model is visible:** the "Using:" indicator, plus **Inspect**, show every block and why it was included. History stores the labels and reasons.
- **The Company Brain is never sent wholesale:** the context engine sends only the blocks a skill needs, within a budget.
- **History is opt-out:** Settings → Privacy → *Save history*. When it is off, no input, output or metadata is stored. *Clear history* deletes everything.
- **Isolation:** the overlay is an extension page in a closed shadow root. The page can't read its contents, the token or the results.
- **Tokens:** only SHA-256 hashes of session and API tokens are stored. Extension tokens are revocable in Settings and can only be minted from a signed-in web session.

## Extension permissions

| Permission | Why |
|---|---|
| `activeTab` | Access the current tab **only** after you press the shortcut or click the toolbar icon. |
| `scripting` | Inject the content script into that tab on demand, instead of running on every site. |
| `storage` | Keep the API token and the page-context preference locally. |
| `clipboardWrite` | Make **Copy** reliable from inside the overlay frame. |
| `host_permissions: <API origin>` | Call the ContextOS API from the overlay/popup. No other hosts. |
| `externally_connectable: <API origin>` | Let the ContextOS web app hand the extension a token after you click Connect. |
| `web_accessible_resources: overlay.*` | Let the content script embed the overlay page as an iframe. |

There is no `<all_urls>` host permission, no `tabs`, no `history`, and no declared content scripts.

---

## Setup

Prerequisites: Node 20+, pnpm 10, PostgreSQL 14+, Chrome 116+.

```bash
pnpm install

# Create a database (any Postgres works; adjust DATABASE_URL accordingly)
createuser -s contextos 2>/dev/null; createdb -O contextos contextos
psql -c "ALTER USER contextos WITH PASSWORD 'contextos';"

# env files → Prisma client → schema → Northstar seed
pnpm setup:local

# Optional: real AI
echo 'ANTHROPIC_API_KEY="sk-ant-…"' >> apps/web/.env.local

pnpm dev            # web on http://localhost:3000 + extension rebuild on change
```

Load the extension:

1. `pnpm --filter @contextos/extension build` (or keep `pnpm dev` running). Output goes to `apps/extension/dist`.
2. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and choose `apps/extension/dist`.
3. On install, the extension opens the web app's **Connect** page. Sign in as `demo@northstar.test` / `northstar-demo`, and it links automatically.
4. Open Gmail, select a draft and press **⌘⇧K** / **Ctrl+Shift+K**.

The extension talks to the API URL fixed at build time. Build against another server with `CONTEXTOS_API_URL=https://app.example.com pnpm --filter @contextos/extension build`.

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | `apps/web/.env.local`, `packages/database/.env` | PostgreSQL connection string |
| `CONTEXTOS_APP_URL` | web | Public URL of the web app (returned to the extension on connect) |
| `ANTHROPIC_API_KEY` | web | Enables Claude (primary provider) |
| `OPENAI_API_KEY` | web | Enables GPT |
| `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) | web | Enables Gemini |
| `ANTHROPIC_MODEL_FAST` / `_BALANCED` / `_POWERFUL` (same for `OPENAI_`, `GEMINI_`) | web | Override model ids per tier |
| `CONTEXTOS_ANTHROPIC_BASE_URL`, `CONTEXTOS_OPENAI_BASE_URL` | web | Point providers at a proxy/gateway |
| `CONTEXTOS_DISABLE_DEMO_MODEL` | web | `true` = fail instead of using the offline demo model |
| `CONTEXTOS_API_URL` | extension build | API origin baked into the extension (default `http://localhost:3000`) |

## Database

Prisma + PostgreSQL ([`packages/database/prisma/schema.prisma`](packages/database/prisma/schema.prisma)):

- **Identity:** `User`, `Session`, `ApiToken`, `Organization`, `OrganizationMember` (OWNER/ADMIN/MEMBER), `UserProfile`, `UserPreference`
- **Verticals:** `Vertical` (catalog), `OrganizationVertical` (+settings JSON), `UserVertical`
- **Company Brain:** `CompanyProfile`, `Product`, `CustomerSegment`, `Competitor`, `BrandProfile`, `Goal` (optional `verticalId`), `KnowledgeDocument` (kind: document/campaign/content example/guideline/note; optional `verticalId`)
- **Activity:** `Workflow`, `AIAction` (History), `AIConversation`, `AIMessage`, `Integration`

Every company record hangs off `organizationId` with cascading deletes. Every API query is scoped by the authenticated user's active organization.

```bash
pnpm db:push       # apply schema (dev)
pnpm db:seed       # (re)seed Northstar — idempotent
pnpm db:reset      # drop + push + seed
pnpm --filter @contextos/database db:migrate   # create a migration for production
```

## Development workflow and testing

```bash
pnpm dev                    # Next.js dev server + extension watch build
pnpm lint                   # ESLint (typescript-eslint, react-hooks)
pnpm typecheck              # tsc in every workspace (Turborepo)
pnpm test                   # Vitest unit tests (47): context engine, router/providers, workflows,
                            #   recommendations, registry, skill execution, DOM adapters (jsdom)
pnpm check                  # lint + typecheck + test

# End-to-end (needs the web app running on :3000 with the seed loaded)
pnpm --filter @contextos/web build && pnpm --filter @contextos/web start &
pnpm test:e2e:extension     # loads the real extension in Chromium; Gmail/LinkedIn/generic flows
pnpm test:e2e:web           # signup → onboarding → Company Brain → playground → history → privacy
```

The extension e2e serves Gmail, LinkedIn and generic fixture pages **on their real domains** (Playwright request interception), so real adapter detection runs. It opens the overlay through the same injection path as the shortcut (synthetic keys can't trigger browser commands), clicks **Rewrite in Brand Voice**, then **Replace**, and asserts the draft changed. It runs headed under Xvfb when available, because headless Chromium mis-routes clicks into out-of-process iframes that were just repositioned. Set `CHROMIUM_PATH` to use a specific Chrome.

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs lint, typecheck, unit tests and the extension build.

## Authentication

The spec suggested Clerk or Supabase Auth. The MVP ships with built-in auth instead (scrypt password hashes, hashed DB sessions in an httpOnly cookie, hashed revocable API tokens for clients) for two reasons:

1. **It runs anywhere with zero external accounts**, so the demo and the e2e tests work offline.
2. **The extension auth story stays simple:** the web session mints an extension token, handed over via `externally_connectable`.

Auth is isolated in [`apps/web/lib/server/auth.ts`](apps/web/lib/server/auth.ts) and [`session.ts`](apps/web/lib/server/session.ts). `authenticate(request)` returns `{ userId, organizationId }` from either a bearer token or the session. Moving to Clerk means replacing those two files: resolve the Clerk session server-side and keep minting ContextOS API tokens for clients. Clerk's Chrome Extension SDK `syncHost` is an alternative for the extension. Nothing else depends on how a user was authenticated.

## Future: desktop apps

The extension is one client of a client-agnostic API. A macOS or Windows app would reuse everything below the adapters:

- **Global shortcut:** a system-wide hotkey (Electron/Tauri `globalShortcut`, or native `RegisterHotKey` / `CGEventTap`).
- **Native adapters:** the same `AppAdapter` contract, implemented with the macOS Accessibility API (`AXUIElement`: focused element, `AXSelectedText`, `AXValue`) or Windows UI Automation (`TextPattern`). Per-app adapters (Slack desktop, Outlook, Word) produce the same `AppContext`.
- **Execution:** `AXSelectedText` set or synthesized paste (pasteboard + ⌘V) as `replace`/`insert` executors.
- **Overlay:** a small always-on-top window that renders the same overlay UI. It is already a standalone React page talking to `/api/v1`.
- **Shared code:** `@contextos/shared/client` types, the API client and the overlay components move into a `@contextos/client` package used by both the extension and desktop.

## Future: marketplace

The pieces of a marketplace already exist as data contracts:

- **Vertical packages** export a `VerticalDefinition`. **Skill packages** export `SkillDefinition`s. **Workflow packages** export `WorkflowDefinition`s. All are built with `defineVertical` / `defineSkill` / step builders.
- `Vertical.source` records where a definition came from (`builtin` today, a package id later), and `OrganizationVertical` is already "install for my org".
- The `VerticalRegistry` validates definitions before registration and can be filled at runtime from installed packages instead of `BUILT_IN_VERTICALS`.
- Third-party code needs a safety boundary. Prompts, schemas and declarative actions can be loaded as data. Code steps (`transformStep`) would run sandboxed, for example in a V8 isolate or a WASM runtime. Context access is already declarative (`requiredContext`), which makes a permission prompt ("This vertical reads: Brand Voice, Products") straightforward.

## Known limitations

- **Google Docs** renders on a canvas. Selection capture works only where Docs exposes it, and insertion types through Docs' input target (beta). Copy/paste is the fallback.
- Gmail and LinkedIn selectors are centralized but will need upkeep as those UIs change.
- The three providers are implemented against the public REST APIs (Anthropic Messages, OpenAI Chat Completions, Gemini generateContent) and unit-tested with mocked HTTP. The automated e2e suites run on the offline demo model, so set a key and try a few actions before relying on a provider.
- No rate limiting, team roles beyond OWNER/ADMIN/MEMBER, or organization switching UI yet.
- Product IDs in the Company Brain are regenerated when a list section is saved (sections are replaced atomically).
