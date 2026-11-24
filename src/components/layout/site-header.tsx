"use client";

import { motion, useMotionValueEvent, useReducedMotion, useScroll } from "framer-motion";
import { Heart, Search, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { ActionLink } from "@/components/layout/action-link";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { DesktopNavigation } from "@/components/layout/desktop-navigation";
import { MobileNavigation } from "@/components/layout/mobile-navigation";
import { SiteLogo } from "@/components/layout/site-logo";
import { useCart } from "@/features/cart/use-cart";

export function SiteHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const reduceMotion = useReducedMotion();
  const { items } = useCart();
  const cartCount = items.reduce((total, item) => total + item.quantity, 0);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (latest) => setIsScrolled(latest > 24));

  return (
    <motion.header
      className="sticky top-0 z-40 border-b border-gold-muted/25 bg-ink/95 shadow-[0_8px_32px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-[border-color,box-shadow] duration-300"
      animate={{ backgroundColor: isScrolled ? "rgba(5,5,5,0.78)" : "rgba(5,5,5,0.96)" }}
      transition={{ duration: reduceMotion ? 0 : 0.24 }}
    >
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-[70] bg-ivory px-4 py-2 text-xs font-bold uppercase tracking-wider text-ink focus:not-sr-only"
      >
        Skip to content
      </a>
      <AnnouncementBar />
      <div className="page-gutter">
        <motion.div
          animate={{ minHeight: isScrolled ? 60 : 72 }}
          transition={{ duration: reduceMotion ? 0 : 0.24 }}
          className="site-container flex items-center justify-between gap-1 py-1.5 sm:grid sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-4 lg:gap-4 xl:gap-8"
        >
          <div className="order-1 flex min-w-0 items-center lg:col-start-1 lg:row-start-1">
            <MobileNavigation />
            <DesktopNavigation />
          </div>

          <div className="order-2 shrink-0 sm:col-start-2 sm:row-start-1 sm:justify-self-center">
            <SiteLogo />
          </div>

          <div className="order-3 flex shrink-0 items-center justify-self-end gap-0.5 sm:col-start-3 sm:row-start-1 sm:gap-2">
            <ActionLink href="/search" label="Search" icon={Search} />
            <ActionLink href="/wishlist" label="Wishlist" icon={Heart} />
            <ActionLink
              href="/cart"
              label={cartCount ? `Shopping cart, ${cartCount} items` : "Shopping cart"}
              icon={ShoppingBag}
              detail="Cart"
              count={cartCount}
            />
          </div>
        </motion.div>
      </div>
    </motion.header>
  );
}
