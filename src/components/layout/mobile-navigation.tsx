"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { primaryNavigation } from "@/components/layout/navigation-data";
import { motionTransition } from "@/lib/motion";

export function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="group inline-flex min-h-11 items-center gap-2 px-1 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-ivory"
        aria-expanded={isOpen}
        aria-controls="mobile-navigation"
      >
        <span>Menu</span>
        <span aria-hidden="true" className="grid w-4 gap-1">
          <span className="h-px w-4 bg-silver transition-transform duration-300 group-hover:translate-x-0.5" />
          <span className="h-px w-2.5 justify-self-end bg-silver transition-[width] duration-300 group-hover:w-4" />
        </span>
      </button>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            id="mobile-navigation"
            className="fixed inset-0 z-50 flex flex-col bg-ink px-5 pb-8 pt-5 sm:px-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={motionTransition}
          >
            <div className="flex items-center justify-between border-b border-smoke pb-5">
              <p className="type-eyebrow">Navigation</p>
              <button type="button" onClick={() => setIsOpen(false)} className="inline-flex min-h-11 min-w-11 items-center justify-center text-silver hover:text-ivory" aria-label="Close menu">
                <X aria-hidden="true" size={21} strokeWidth={1.4} />
              </button>
            </div>
            <nav className="flex flex-1 items-center" aria-label="Mobile primary navigation">
              <ul className="w-full space-y-1">
                {primaryNavigation.map((item, index) => (
                  <motion.li key={item.href} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ ...motionTransition, delay: index * 0.055 }}>
                    <Link href={item.href} onClick={() => setIsOpen(false)} className="block border-b border-smoke py-4 font-display text-4xl font-medium tracking-[-0.04em] text-ivory transition-colors hover:text-gold sm:text-5xl">
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
