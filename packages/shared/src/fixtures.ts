import type { AppContext, CompanyContext, UserContext } from "./client";

/** Test fixtures shared by package tests (Northstar demo data). */
export function northstarCompany(): CompanyContext {
  return {
    organizationId: "org_1",
    company: {
      name: "Northstar",
      industry: "Consumer wellness technology",
      website: "https://northstar.example",
      description: "Wearable technology for recovery, stress and sleep insights.",
    },
    products: [
      { id: "p1", name: "Northstar Band", description: "A screenless wearable.", features: ["Readiness score"], pricing: "$249", isPrimary: true },
      { id: "p2", name: "Northstar Membership", description: "App membership.", features: [], pricing: null, isPrimary: false },
    ],
    customers: [
      { id: "c1", name: "Young professionals", description: "25-35", painPoints: ["Burnout"], isPrimary: true },
      { id: "c2", name: "Busy executives", description: "Time-poor leaders", painPoints: ["Stress"], isPrimary: false },
    ],
    competitors: [
      { id: "k1", name: "WHOOP", positioning: "Subscription strap", differentiators: "We are bought outright" },
      { id: "k2", name: "Oura", positioning: "Smart ring", differentiators: "Band form factor" },
    ],
    brand: {
      voiceAttributes: ["Confident", "Minimal", "Evidence-oriented"],
      voiceDescription: "Calm coach.",
      positioning: "The calmest way to understand recovery.",
      tagline: "Know when to push.",
      doList: ["Lead with a benefit"],
      dontList: ["Hype words"],
    },
    goals: [
      { id: "g1", title: "Increase product awareness", verticalId: "marketing" },
      { id: "g2", title: "Close Series B", verticalId: "finance" },
    ],
    knowledge: [
      { id: "d1", kind: "CAMPAIGN", title: "Fall launch campaign", content: "Launch email to the waitlist about recovery.", tags: ["launch", "email"], verticalId: "marketing" },
      { id: "d2", kind: "GUIDELINE", title: "Claims guidelines", content: "Never make medical claims.", tags: ["compliance"], verticalId: null },
    ],
  };
}

export function marketerUser(): UserContext {
  return {
    userId: "u1",
    name: "Alex Rivera",
    role: "Head of Marketing",
    preferredProvider: "auto",
    enabledVerticals: ["marketing"],
    activeVertical: "marketing",
  };
}

export function gmailContext(overrides: Partial<AppContext> = {}): AppContext {
  return {
    appId: "gmail",
    appName: "Gmail",
    domain: "mail.google.com",
    pageTitle: "Inbox",
    pageUrl: "https://mail.google.com/mail/u/0/",
    selectedText: "Hi John, just wanted to follow up regarding our new platform.",
    activeElementType: "contenteditable",
    surface: "email-compose",
    metadata: {},
    ...overrides,
  };
}
