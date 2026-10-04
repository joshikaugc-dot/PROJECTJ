import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: [
    "@contextos/ai",
    "@contextos/context",
    "@contextos/database",
    "@contextos/shared",
    "@contextos/ui",
    "@contextos/verticals",
    "@contextos/workflows",
  ],
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  poweredByHeader: false,
  typedRoutes: false,
};

export default nextConfig;
