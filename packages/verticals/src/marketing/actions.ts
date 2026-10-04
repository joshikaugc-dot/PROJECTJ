import type { ActionDefinition } from "../core/types";

/**
 * Marketing's recommended actions. Generic actions work everywhere; app-tuned
 * actions appear only in their app and may supersede a generic one.
 * The recommendation engine (core) ranks them — nothing here is app logic.
 */
export const marketingActions: ActionDefinition[] = [
  /* ---------------- Generic (any app) ---------------- */
  { id: "rewrite-brand-voice", label: "Rewrite in Brand Voice", skillId: "rewrite-brand-voice", icon: "sparkles", priority: 100, requiresText: true, description: "Make it sound like your brand" },
  { id: "improve", label: "Improve", skillId: "improve-copy", icon: "wand", priority: 80, requiresText: true, description: "Clarity, persuasion, specificity, CTA" },
  { id: "shorten", label: "Shorten", skillId: "shorten", icon: "minimize", priority: 70, requiresText: true, description: "Same meaning, fewer words" },
  { id: "expand", label: "Expand", skillId: "expand", icon: "maximize", priority: 45, requiresText: true, description: "Develop into stronger copy" },
  { id: "social-post", label: "Turn into Social Post", skillId: "social-content", icon: "share", priority: 40, requiresText: true, options: { channel: "all" }, description: "LinkedIn, Instagram and X versions" },
  { id: "write-email", label: "Write Marketing Email", skillId: "email-generator", icon: "mail", priority: 35, onlyWithoutText: true, roles: ["marketing", "growth", "cmo", "founder"], description: "Subject, preview, body and CTA" },
  { id: "campaign-ideas", label: "Campaign Ideas", skillId: "campaign-ideas", icon: "target", priority: 30, roles: ["cmo", "head", "founder", "director"], description: "Idea, audience, message, channels" },
  { id: "content-ideas", label: "Content Ideas", skillId: "content-ideas", icon: "lightbulb", priority: 28, roles: ["content", "social", "growth"], description: "Ideas for your audience and goals" },
  { id: "competitor-analysis", label: "Competitor Analysis", skillId: "competitor-analysis", icon: "swords", priority: 20, roles: ["cmo", "product marketing", "founder"], description: "Where you win and how to say it" },

  /* ---------------- Gmail ---------------- */
  { id: "gmail-improve-conversion", label: "Improve Conversion", skillId: "improve-copy", icon: "trending-up", priority: 70, requiresText: true, options: { focus: "conversion" }, appliesTo: { apps: ["gmail"] }, supersedes: ["improve"], description: "Sharper value, single clear CTA" },
  { id: "gmail-follow-up", label: "Create Follow-Up", skillId: "follow-up", icon: "reply", priority: 46, appliesTo: { apps: ["gmail"] }, description: "A follow-up that adds value" },
  { id: "gmail-subject-lines", label: "Generate Subject Lines", skillId: "subject-lines", icon: "heading", priority: 38, requiresText: true, appliesTo: { apps: ["gmail"] }, description: "5 on-brand options" },
  { id: "gmail-persuasive", label: "Make More Persuasive", skillId: "improve-copy", icon: "megaphone", priority: 36, requiresText: true, options: { focus: "persuasion" }, appliesTo: { apps: ["gmail"] }, description: "Lead with the reader's benefit" },
  { id: "gmail-write-email", label: "Draft Email", skillId: "email-generator", icon: "mail", priority: 90, onlyWithoutText: true, appliesTo: { apps: ["gmail"] }, supersedes: ["write-email"], description: "Draft from your company context" },

  /* ---------------- LinkedIn ---------------- */
  { id: "linkedin-write-post", label: "Write Post", skillId: "social-content", icon: "pen", priority: 95, options: { channel: "linkedin" }, appliesTo: { apps: ["linkedin"] }, onlyWithoutText: true, description: "An on-brand LinkedIn post" },
  { id: "linkedin-rewrite-post", label: "Rewrite as LinkedIn Post", skillId: "social-content", icon: "pen", priority: 72, requiresText: true, options: { channel: "linkedin" }, appliesTo: { apps: ["linkedin"] }, supersedes: ["social-post"], description: "Native LinkedIn formatting" },
  { id: "linkedin-improve-hook", label: "Improve Hook", skillId: "improve-copy", icon: "anchor", priority: 88, requiresText: true, options: { focus: "hook" }, appliesTo: { apps: ["linkedin"] }, supersedes: ["improve"], description: "A first line that stops the scroll" },
  { id: "linkedin-thought-leadership", label: "Thought-Leadership Version", skillId: "social-content", icon: "brain", priority: 70, requiresText: true, options: { channel: "linkedin", style: "thought-leadership" }, appliesTo: { apps: ["linkedin"] }, roles: ["founder", "cmo", "head", "director"], description: "A point of view, not a pitch" },
  { id: "linkedin-comments", label: "Generate Comments", skillId: "social-content", icon: "message", priority: 60, options: { channel: "linkedin", format: "comment" }, appliesTo: { apps: ["linkedin"], surfaces: ["comment"] }, description: "Thoughtful replies to this post" },

  /* ---------------- Docs & Notion ---------------- */
  { id: "docs-improve-section", label: "Improve Section", skillId: "improve-copy", icon: "wand", priority: 88, requiresText: true, appliesTo: { apps: ["google-docs", "notion"] }, supersedes: ["improve"], description: "Tighter, clearer, more persuasive" },
  { id: "docs-continue", label: "Continue Writing", skillId: "expand", icon: "arrow-right", priority: 82, requiresText: true, options: { mode: "continue" }, appliesTo: { apps: ["google-docs", "notion"] }, description: "Pick up where you left off" },
  { id: "docs-campaign-brief", label: "Create Campaign Brief", skillId: "campaign-ideas", icon: "target", priority: 70, appliesTo: { apps: ["google-docs", "notion"] }, supersedes: ["campaign-ideas"], description: "A structured multi-step brief" },
  { id: "docs-summarize", label: "Summarize", skillId: "shorten", icon: "list", priority: 64, requiresText: true, options: { mode: "summary" }, appliesTo: { apps: ["google-docs", "notion"] }, description: "Key points in a few lines" },
];
