import { defineSkill, option, textOutput } from "../../core/define";
import { instructionBlock, textBlock } from "../../core/prompt";

const CHANNEL_RULES: Record<string, string> = {
  linkedin:
    "LinkedIn post: a scroll-stopping first line, short paragraphs with line breaks, a concrete insight, end with a question or soft CTA, at most 3 relevant hashtags at the end. 120–220 words.",
  instagram:
    "Instagram caption: a punchy opening line, 2–4 short lines, a clear CTA, then 5–8 relevant hashtags on their own line. Emojis sparingly.",
  x: "X (Twitter) post: under 270 characters, one sharp idea, no more than 1 hashtag. If more is needed, write a 3–5 post thread numbered 1/, 2/, …",
};

export const socialContent = defineSkill<string>({
  id: "social-content",
  name: "Social Content",
  description: "Creates social content for LinkedIn, Instagram and X.",
  output: "text",
  outputSchema: textOutput,
  systemInstructions: `Write social media content in the brand voice for the company's audience.
- Never fabricate statistics, customers or testimonials.
- Make it native to the channel — not a press release.`,
  requiredContext: ["brand.voice", "customers"],
  optionalContext: ["products", "brand.positioning", "goals", "content-examples", "campaigns", "app.nearby"],
  preferredModel: { taskType: "writing" },
  allowedActions: ["replace", "insert", "copy"],
  requiresText: false,
  maxTokens: 1500,
  buildPrompt: (input, ctx) => {
    const channel = option(
      input.options,
      "channel",
      ctx.appContext.appId === "linkedin" ? "linkedin" : "all",
    );
    const format = option(input.options, "format", "post");
    const style = option(input.options, "style", "standard");

    if (format === "comment") {
      return `Write 3 thoughtful comment options (each 1–3 sentences) the user could post in reply to this LinkedIn post. Add perspective from our expertise — no self-promotion, no generic praise. Separate them with a blank line and number them 1., 2., 3.\n${textBlock(input.nearbyText || input.text)}${instructionBlock(input.instruction)}`;
    }

    const rules =
      channel === "all"
        ? `Write one version for each channel, each preceded by a plain label line ("LinkedIn", "Instagram", "X"):\n- ${CHANNEL_RULES.linkedin}\n- ${CHANNEL_RULES.instagram}\n- ${CHANNEL_RULES.x}`
        : (CHANNEL_RULES[channel] ?? CHANNEL_RULES.linkedin);
    const styleNote =
      style === "thought-leadership"
        ? "\nMake it a thought-leadership piece: a clear point of view, an insight from experience, and a takeaway the reader can use — not a product pitch."
        : "";
    const source = input.text
      ? `\nBase it on this text:\n${textBlock(input.text)}`
      : "\nChoose a timely, relevant topic for the company's audience and goals.";
    return `${rules}${styleNote}${source}${instructionBlock(input.instruction)}`;
  },
});
