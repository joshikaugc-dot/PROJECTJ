import type { Metadata } from "next";
import { PRODUCT } from "@contextos/shared";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: PRODUCT.name, template: `%s · ${PRODUCT.name}` },
  description: PRODUCT.tagline,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans text-sm">{children}</body>
    </html>
  );
}
