"use client";

import { motion, useReducedMotion, useScroll, useMotionValueEvent } from "framer-motion";
import { useState } from "react";
import { Heart, Search, ShoppingBag } from "lucide-react";
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
      <a href="#main-content" className="sr-only fixed left-4 top-4 z-[60] bg-ivory px-4 py-2 text-xs font-bold uppercase tracking-wider text-ink focus:not-sr-only">
        Skip to content
      </a>
      <AnnouncementBar />
      <div className="page-gutter">
        <motion.div animate={{ minHeight: isScrolled ? 64 : 76 }} transition={{ duration: reduceMotion ? 0 : 0.24 }} className="site-container relative grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-1 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-8">
          <div className="absolute left-1/2 -translate-x-1/2 lg:static lg:col-start-2 lg:row-start-1 lg:translate-x-0">
            <SiteLogo />
          </div>
          <div className="order-1 hidden lg:col-start-1 lg:row-start-1 lg:block">
            <DesktopNavigation />
          </div>
          <div className="order-3 flex items-center justify-self-end gap-1 sm:gap-2 lg:col-start-3 lg:row-start-1">
            <div className="lg:hidden"><MobileNavigation /></div>
            <ActionLink href="/search" label="Search" icon={Search} />
            <ActionLink href="/wishlist" label="Wishlist" icon={Heart} />
            <ActionLink href="/cart" label={cartCount ? `Shopping cart, ${cartCount} items` : "Shopping cart"} icon={ShoppingBag} detail="Cart" count={cartCount} />
          </div>
        </motion.div>
      </div>
    </motion.header>
  );
}
