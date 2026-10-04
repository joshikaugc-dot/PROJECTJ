/**
 * Seeds the Northstar demo organization so the product is testable
 * immediately. Idempotent: re-running replaces the demo org and user.
 *
 *   Demo login: demo@northstar.test / northstar-demo
 */
import { BUILT_IN_VERTICALS } from "@contextos/verticals";
import { prisma } from "./client";
import { hashPassword } from "./crypto";
import { syncVerticalCatalog } from "./verticals";

export const DEMO_EMAIL = "demo@northstar.test";
export const DEMO_PASSWORD = "northstar-demo";

async function main() {
  await syncVerticalCatalog(prisma, BUILT_IN_VERTICALS);

  await prisma.organization.deleteMany({ where: { slug: "northstar" } });
  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });

  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      name: "Alex Rivera",
      passwordHash: await hashPassword(DEMO_PASSWORD),
      preference: { create: { preferredProvider: "auto", historyEnabled: true } },
    },
  });

  const org = await prisma.organization.create({
    data: {
      name: "Northstar",
      slug: "northstar",
      members: { create: { userId: user.id, role: "OWNER" } },
      companyProfile: {
        create: {
          industry: "Consumer wellness technology",
          website: "https://northstar.example",
          description:
            "Northstar makes wearable technology for recovery, stress and sleep insights. The Northstar Band turns continuous physiological data into a simple daily readiness picture so people can decide when to push, when to recover, and how to sleep better.",
        },
      },
      brandProfile: {
        create: {
          voiceAttributes: ["Confident", "Minimal", "Evidence-oriented", "Optimistic", "Never overly salesy"],
          voiceDescription:
            "We sound like a calm, knowledgeable coach: short sentences, plain words, specific claims backed by what the product actually measures. We are optimistic about what people can change, and we never pressure.",
          positioning:
            "The calmest, clearest way to understand your recovery — insight you can act on in ten seconds, without a screen on your wrist or a wall of charts.",
          tagline: "Know when to push. Know when to rest.",
          doList: [
            "Lead with a concrete benefit",
            "Reference what the band measures (HRV, resting heart rate, sleep stages, skin temperature)",
            "Use short paragraphs and plain language",
            "End with one clear, low-pressure next step",
          ],
          dontList: [
            "Hype words: revolutionary, game-changing, ultimate, biohack",
            "Medical claims or promises to cure, diagnose or treat",
            "Exclamation marks in more than one sentence",
            "Fake urgency (\"act now\", \"last chance\")",
          ],
        },
      },
      products: {
        create: [
          {
            name: "Northstar Band",
            isPrimary: true,
            description:
              "A screenless wearable that tracks heart rate variability, resting heart rate, sleep stages and skin temperature to produce a daily Readiness score, stress insights and sleep guidance.",
            features: [
              "Daily Readiness score from HRV, resting heart rate and sleep",
              "Real-time stress insights with guided breathing",
              "Sleep staging and personalized bedtime guidance",
              "7-day battery, water resistant to 50m",
              "Screenless design — no notifications, no distractions",
            ],
            pricing: "$249 band, includes 12 months of Northstar membership",
          },
          {
            name: "Northstar Membership",
            description: "The app experience: trends, weekly recovery reports and coaching programs.",
            features: ["Weekly recovery report", "8-week sleep program", "Trend history and export"],
            pricing: "$6/month after the first year",
          },
        ],
      },
      customerSegments: {
        create: [
          {
            name: "Young professionals",
            isPrimary: true,
            description: "25–35, ambitious, juggling career and health, early adopters of wellness tech.",
            painPoints: ["Inconsistent sleep", "Burnout and stress", "Too many apps with no clear answer"],
          },
          {
            name: "Fitness-focused consumers",
            description: "Train 4+ times a week, care about performance and avoiding overtraining.",
            painPoints: ["Not knowing when to rest", "Plateaus", "Wrist devices that distract during the day"],
          },
          {
            name: "Busy executives",
            description: "Time-poor leaders who want health insight without another screen or notifications.",
            painPoints: ["Travel and jet lag", "Chronic stress", "No time to analyze data"],
          },
        ],
      },
      competitors: {
        create: [
          {
            name: "WHOOP",
            website: "https://www.whoop.com",
            positioning: "Performance-focused strap sold as a subscription.",
            differentiators: "Northstar is bought outright with an included first year, and focuses on calm daily guidance over strain metrics.",
          },
          {
            name: "Oura",
            website: "https://ouraring.com",
            positioning: "Smart ring for sleep and readiness.",
            differentiators: "Northstar's band form factor suits people who train with their hands and adds real-time stress insights with guided breathing.",
          },
          {
            name: "Garmin",
            website: "https://www.garmin.com",
            positioning: "Feature-rich GPS sports watches.",
            differentiators: "Northstar is screenless and recovery-first: fewer features, clearer answers, no notifications.",
          },
        ],
      },
      goals: {
        create: [
          {
            verticalId: "marketing",
            title: "Increase product awareness",
            description: "Grow awareness of the Northstar Band among young professionals ahead of the fall launch.",
            metric: "Aided awareness +10 points; 50k launch waitlist sign-ups",
            timeframe: "Q4",
          },
          {
            verticalId: "marketing",
            title: "Drive customer acquisition",
            description: "Convert waitlist and site traffic into first purchases.",
            metric: "8,000 bands sold; CAC under $70",
            timeframe: "Q4",
          },
        ],
      },
      documents: {
        create: [
          {
            kind: "CAMPAIGN",
            verticalId: "marketing",
            title: "Fall launch campaign: \"Rest is a skill\"",
            tags: ["launch", "campaign", "email", "fall"],
            content:
              "Campaign: Rest is a skill. Launch window: October 15 – November 30. Core message: recovery is something you can get better at, and the Northstar Band shows you how — one clear Readiness score each morning. Launch offer: free expedited shipping for waitlist members. Channels: email to waitlist, LinkedIn thought-leadership from the founders, Instagram creator partnerships with run clubs, podcast ads.",
          },
          {
            kind: "CONTENT_EXAMPLE",
            verticalId: "marketing",
            title: "Approved email example: waitlist welcome",
            tags: ["email", "example", "waitlist"],
            content:
              "Subject: You're on the list\n\nHi Sam,\n\nThanks for joining the Northstar waitlist. You'll be among the first to know when the Band ships this fall.\n\nWhat you'll get: one Readiness score every morning, built from your HRV, resting heart rate and sleep. No screen. No noise. Just a clear answer to \"push or rest?\".\n\nWe'll be in touch soon.\n\nThe Northstar team",
          },
          {
            kind: "GUIDELINE",
            title: "Claims and compliance guidelines",
            tags: ["compliance", "claims", "health"],
            content:
              "Northstar is a wellness product, not a medical device. Never claim to diagnose, treat or prevent any condition. Say \"insights\" and \"guidance\", not \"diagnosis\". Do not quote accuracy percentages unless citing the published validation study. Battery claim: up to 7 days.",
          },
        ],
      },
      verticals: { create: [{ verticalId: "marketing", enabled: true }] },
      integrations: {
        create: [
          { provider: "gmail", status: "available" },
          { provider: "linkedin", status: "available" },
        ],
      },
    },
  });

  await prisma.userProfile.create({
    data: {
      userId: user.id,
      jobTitle: "Head of Marketing",
      department: "Marketing",
      seniority: "Leadership",
      responsibilities: "Brand, launch campaigns, growth marketing and the content team.",
      writingPreferences: "Prefers short paragraphs and a single CTA. Signs emails with first name only.",
      activeOrganizationId: org.id,
      activeVerticalId: "marketing",
      onboardingCompleted: true,
    },
  });
  await prisma.userVertical.create({
    data: { userId: user.id, organizationId: org.id, verticalId: "marketing", enabled: true },
  });

  console.log(`Seeded Northstar (${org.id}). Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
