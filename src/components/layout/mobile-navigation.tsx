"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { primaryNavigation } from "@/components/layout/navigation-data";

export function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(document.querySelectorAll<HTMLElement>("#mobile-navigation button, #mobile-navigation a[href]"));
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
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="lg:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(true)}
        className="group inline-flex min-h-11 items-center gap-2 px-1 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-ivory transition-colors duration-250 hover:text-gold focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold"
        aria-expanded={isOpen}
        aria-controls="mobile-navigation"
        aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
      >
        <span aria-hidden="true">Menu</span>
        <span aria-hidden="true" className="grid w-4 gap-1">
          <span className="h-px w-4 bg-silver transition-transform duration-300 group-hover:translate-x-0.5" />
          <span className="h-px w-2.5 justify-self-end bg-silver transition-[width] duration-300 group-hover:w-4" />
        </span>
      </button>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            id="mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
            className="fixed inset-0 z-50 flex flex-col bg-ink/98 px-5 pb-8 pt-5 backdrop-blur-xl sm:px-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.24, ease: "easeOut" }}
          >
            <div className="flex items-center justify-between border-b border-smoke pb-5">
              <p className="type-eyebrow">Navigation</p>
              <button ref={closeRef} type="button" onClick={() => { setIsOpen(false); triggerRef.current?.focus(); }} className="inline-flex min-h-11 min-w-11 items-center justify-center text-silver transition-colors duration-250 hover:text-gold focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold" aria-label="Close menu">
                <X aria-hidden="true" size={21} strokeWidth={1.4} />
              </button>
            </div>
            <nav className="flex flex-1 items-center" aria-label="Mobile primary navigation">
              <ul className="w-full space-y-1">
                {primaryNavigation.map((item, index) => (
                  <motion.li key={item.href} initial={{ opacity: 0, x: reduceMotion ? 0 : -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: reduceMotion ? 0 : 0.24, delay: reduceMotion ? 0 : index * 0.025 }}>
                    <Link href={item.href} onClick={() => setIsOpen(false)} className="block border-b border-smoke py-4 font-display text-4xl font-medium tracking-[-0.04em] text-ivory transition-colors duration-250 hover:text-gold focus-visible:text-gold sm:text-5xl">
                      {item.label}
                    </Link>
                  </motion.li>
                ))}
              </ul>
            </nav>
            <p className="type-eyebrow border-t border-smoke pt-5">Define your presence.</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
