import type { Metadata } from "next";
import { connection } from "next/server";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { CommerceProvider } from "@/features/cart/commerce-provider";
import { getCatalogProducts } from "@/services/products-service";
import "./globals.css";

const displayFont = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const bodyFont = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "TOXIDO | Define Your Presence",
    template: "%s | TOXIDO",
  },
  description: "Fragrance and accessories for the modern gentleman.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();
  const { products, isDemo } = await getCatalogProducts();
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>
        <CommerceProvider products={products} catalogIsDemo={isDemo}>
          <SiteHeader />
          <main id="main-content" className="site-main">
            {children}
          </main>
          <SiteFooter />
        </CommerceProvider>
      </body>
    </html>
  );
}
