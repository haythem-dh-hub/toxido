import type { Transition, Variants } from "framer-motion";

export const motionTransition: Transition = {
  duration: 0.45,
  ease: [0.22, 1, 0.36, 1],
};

export const revealUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: motionTransition },
};

export const staggerReveal: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: motionTransition },
};
