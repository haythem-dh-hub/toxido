"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { revealUp } from "@/lib/motion";

export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.div className={className} variants={revealUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} transition={shouldReduceMotion ? { duration: 0 } : { delay }}>
      {children}
    </motion.div>
  );
}
