import { VerticalRegistry } from "./core/registry";
import { marketingVertical } from "./marketing";
import { salesVertical } from "./sales";
import { financeVertical } from "./finance";
import { recruitingVertical } from "./recruiting";
import { consultingVertical, operationsVertical, realEstateVertical } from "./_coming-soon";

export * from "./core";
export { marketingVertical } from "./marketing";
export { salesVertical } from "./sales";
export { financeVertical } from "./finance";
export { recruitingVertical } from "./recruiting";
export { realEstateVertical, consultingVertical, operationsVertical } from "./_coming-soon";

/** Every vertical shipped with the platform, in display order. */
export const BUILT_IN_VERTICALS = [
  marketingVertical,
  salesVertical,
  financeVertical,
  recruitingVertical,
  realEstateVertical,
  consultingVertical,
  operationsVertical,
];

/** The registry the platform uses. A marketplace would register more here at runtime. */
export function createDefaultRegistry(): VerticalRegistry {
  const registry = new VerticalRegistry();
  for (const vertical of BUILT_IN_VERTICALS) registry.register(vertical);
  return registry;
}
