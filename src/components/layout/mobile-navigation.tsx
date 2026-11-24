"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { primaryNavigation } from "@/components/layout/navigation-data";
import { SiteLogo } from "@/components/layout/site-logo";

const subscribeNoop = () => () => {};

export function MobileNavigation() {
  const pathname = usePathname();
  const [openPathname, setOpenPathname] = useState<string | null>(null);
  const isOpen = openPathname === pathname;
  const reduceMotion = useReducedMotion();
  const isClient = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const closeMenu = useCallback((restoreFocus = false) => {
    setOpenPathname(null);
    if (restoreFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  // Close drawer automatically if resized to desktop breakpoint so body scroll is never left locked.
  useEffect(() => {
    if (!isOpen) return;
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const handleResize = (event: MediaQueryListEvent) => {
      if (event.matches) setOpenPathname(null);
    };
    mediaQuery.addEventListener("change", handleResize);
    return () => mediaQuery.removeEventListener("change", handleResize);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    const focusTimer = requestAnimationFrame(() => closeRef.current?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        document.querySelectorAll<HTMLElement>("#mobile-navigation button, #mobile-navigation a[href]")
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(focusTimer);
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, closeMenu]);

  const drawerTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <div className="lg:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpenPathname(pathname)}
        className="group inline-flex min-h-11 min-w-8 items-center justify-center gap-2 px-1 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-ivory transition-colors duration-250 hover:text-gold focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold sm:min-w-10"
        aria-expanded={isOpen}
        aria-controls="mobile-navigation"
        aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
      >
        <span aria-hidden="true" className="grid w-4 shrink-0 gap-1">
          <span className="h-px w-4 bg-silver transition-transform duration-300 group-hover:translate-x-0.5 group-hover:bg-gold" />
          <span className="h-px w-2.5 justify-self-start bg-silver transition-[width,background-color] duration-300 group-hover:w-4 group-hover:bg-gold" />
        </span>
        <span aria-hidden="true" className="hidden min-[380px]:inline">Menu</span>
      </button>

      {isClient
        ? createPortal(
            <AnimatePresence>
              {isOpen ? (
                <div className="fixed inset-0 z-50 lg:hidden">
                  <motion.div
                    aria-hidden="true"
                    className="fixed inset-0 bg-black/75 backdrop-blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.24, ease: "easeOut" }}
                    onClick={() => closeMenu(true)}
                  />

                  <motion.div
                    id="mobile-navigation"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Main navigation"
                    className="fixed inset-y-0 left-0 z-10 flex h-[100dvh] w-full max-w-sm flex-col overflow-hidden border-r border-gold-muted/25 bg-ink shadow-[0_24px_80px_rgba(0,0,0,0.65)]"
                    initial={{ x: reduceMotion ? 0 : "-100%", opacity: reduceMotion ? 0 : 1 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: reduceMotion ? 0 : "-100%", opacity: reduceMotion ? 0 : 1 }}
                    transition={drawerTransition}
                  >
                    <div className="flex shrink-0 items-center justify-between gap-4 border-b border-smoke px-5 py-4 sm:px-6">
                      <SiteLogo onClick={() => closeMenu(false)} />
                      <button
                        ref={closeRef}
                        type="button"
                        onClick={() => closeMenu(true)}
                        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-smoke text-silver transition-colors duration-250 hover:border-gold/60 hover:text-gold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold"
                        aria-label="Close navigation menu"
                      >
                        <X aria-hidden="true" size={20} strokeWidth={1.5} />
                      </button>
                    </div>

                    <nav
                      className="flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-6"
                      aria-label="Mobile primary navigation"
                    >
                      <p className="type-eyebrow mb-4 text-gold-muted">Navigation</p>
                      <ul className="divide-y divide-smoke/80 border-y border-smoke/80">
                        {primaryNavigation.map((item, index) => {
                          const isActive = pathname === item.href;
                          return (
                            <motion.li
                              key={item.href}
                              initial={{ opacity: 0, x: reduceMotion ? 0 : -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{
                                duration: reduceMotion ? 0 : 0.22,
                                delay: reduceMotion ? 0 : 0.04 + index * 0.03,
                              }}
                            >
                              <Link
                                href={item.href}
                                onClick={() => closeMenu(false)}
                                className={`group flex items-center justify-between gap-4 py-3.5 font-toxido-display text-2xl font-medium tracking-[0.01em] transition-colors duration-250 hover:text-gold focus-visible:text-gold sm:py-4 sm:text-[1.75rem] ${
                                  isActive ? "text-gold" : "text-ivory"
                                }`}
                              >
                                <span>{item.label}</span>
                                <ArrowUpRight
                                  aria-hidden="true"
                                  size={16}
                                  strokeWidth={1.4}
                                  className="shrink-0 text-silver/50 transition-[color,transform] duration-250 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-gold"
                                />
                              </Link>
                            </motion.li>
                          );
                        })}
                      </ul>
                    </nav>

                    <div className="shrink-0 border-t border-smoke px-5 py-4 sm:px-6">
                      <p className="type-eyebrow text-silver/80">Define your presence.</p>
                    </div>
                  </motion.div>
                </div>
              ) : null}
            </AnimatePresence>,
            document.body
          )
        : null}
    </div>
  );
}
