import {
  Anchor,
  ArrowRight,
  Brain,
  Heading,
  Lightbulb,
  List,
  Mail,
  Maximize2,
  Megaphone,
  MessageSquare,
  Minimize2,
  PenLine,
  Reply,
  Share2,
  Sparkles,
  Swords,
  Target,
  TrendingUp,
  Wand2,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  wand: Wand2,
  minimize: Minimize2,
  maximize: Maximize2,
  share: Share2,
  mail: Mail,
  target: Target,
  lightbulb: Lightbulb,
  swords: Swords,
  "trending-up": TrendingUp,
  reply: Reply,
  heading: Heading,
  megaphone: Megaphone,
  pen: PenLine,
  anchor: Anchor,
  brain: Brain,
  message: MessageSquare,
  "arrow-right": ArrowRight,
  list: List,
};

export function ActionIcon({ name }: { name?: string }) {
  const Icon = (name && ICONS[name]) || Sparkles;
  return <Icon size={14} strokeWidth={2} />;
}
