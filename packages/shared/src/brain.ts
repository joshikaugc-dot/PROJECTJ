import { z } from "zod";

/**
 * Company Brain sections. Shared by the web app (forms), the API (validation)
 * and onboarding. Organizations explain themselves once, here.
 */

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((v) => (v && v.trim() ? v.trim() : null));
const stringList = z.array(z.string().trim().min(1).max(300)).max(50).default([]);

export const companySectionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  industry: optionalText(120),
  website: optionalText(300),
  description: optionalText(4000),
});

export const productSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(120),
  description: optionalText(2000),
  features: stringList,
  pricing: optionalText(300),
  isPrimary: z.boolean().default(false),
});

export const customerSegmentSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(120),
  description: optionalText(2000),
  painPoints: stringList,
  isPrimary: z.boolean().default(false),
});

export const competitorSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(120),
  website: optionalText(300),
  positioning: optionalText(1000),
  differentiators: optionalText(1000),
});

export const brandSectionSchema = z.object({
  voiceAttributes: stringList,
  voiceDescription: optionalText(2000),
  positioning: optionalText(2000),
  tagline: optionalText(200),
  doList: stringList,
  dontList: stringList,
});

export const goalSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1).max(200),
  description: optionalText(1000),
  metric: optionalText(200),
  timeframe: optionalText(100),
  verticalId: optionalText(64),
});

export const knowledgeKindSchema = z.enum(["DOCUMENT", "CAMPAIGN", "CONTENT_EXAMPLE", "GUIDELINE", "NOTE"]);

export const documentSchema = z.object({
  id: z.string().optional(),
  kind: knowledgeKindSchema.default("DOCUMENT"),
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(50_000),
  tags: stringList,
  verticalId: optionalText(64),
});

export const brainSectionSchemas = {
  company: companySectionSchema,
  products: z.array(productSchema).max(50),
  customers: z.array(customerSegmentSchema).max(50),
  brand: brandSectionSchema,
  competitors: z.array(competitorSchema).max(50),
  goals: z.array(goalSchema).max(50),
  documents: z.array(documentSchema).max(200),
} as const;

export type BrainSection = keyof typeof brainSectionSchemas;
export const BRAIN_SECTIONS = Object.keys(brainSectionSchemas) as BrainSection[];

export type CompanySection = z.output<typeof companySectionSchema>;
export type ProductInput = z.output<typeof productSchema>;
export type CustomerSegmentInput = z.output<typeof customerSegmentSchema>;
export type CompetitorInput = z.output<typeof competitorSchema>;
export type BrandSection = z.output<typeof brandSectionSchema>;
export type GoalInput = z.output<typeof goalSchema>;
export type DocumentInput = z.output<typeof documentSchema>;

export interface Brain {
  company: CompanySection;
  products: ProductInput[];
  customers: CustomerSegmentInput[];
  brand: BrandSection;
  competitors: CompetitorInput[];
  goals: GoalInput[];
  documents: DocumentInput[];
}
