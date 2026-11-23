"use client";

import Image from "next/image";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";

const particles = [
  { left: "14%", top: "28%", delay: "0s", size: 100 },
  { left: "31%", top: "18%", delay: "2.3s", size: 150 },
  { left: "58%", top: "24%", delay: "4.1s", size: 100 },
  { left: "79%", top: "33%", delay: "1.4s", size: 1.5 },
  { left: "88%", top: "62%", delay: "5.2s", size: 2 },
  { left: "43%", top: "72%", delay: "3.1s", size: 150 },
];

export function CinematicHeroBackground({ src, alt }: { src: string; alt: string }) {
  const reduceMotion = useReducedMotion();
  const backgroundRef = useRef<HTMLDivElement>(null);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const smoothX = useSpring(pointerX, { stiffness: 28, damping: 20, mass: 1.2 });
  const smoothY = useSpring(pointerY, { stiffness: 28, damping: 20, mass: 1.2 });
  const x = useTransform(smoothX, [-1, 1], [-9, 9]);
  const y = useTransform(smoothY, [-1, 1], [-6, 6]);

  useEffect(() => {
    if (reduceMotion) return;
    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !backgroundRef.current) return;
      const bounds = backgroundRef.current.getBoundingClientRect();
      if (event.clientY < bounds.top || event.clientY > bounds.bottom || event.clientX < bounds.left || event.clientX > bounds.right) {
        pointerX.set(0);
        pointerY.set(0);
        return;
      }
      pointerX.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1);
      pointerY.set(((event.clientY - bounds.top) / bounds.height) * 2 - 1);
    };
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [pointerX, pointerY, reduceMotion]);

  return (
    <div ref={backgroundRef} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <motion.div className="absolute -inset-[2%]" style={reduceMotion ? undefined : { x, y }}>
        <div className={reduceMotion ? "absolute inset-0" : "hero-image-drift absolute inset-0"}>
          <Image src={src} alt={alt} fill priority sizes="100vw" className="object-cover" />
        </div>
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-r from-ink/85 via-ink/52 to-ink/14" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/65 via-transparent to-ink/15" />
      <div className={reduceMotion ? "absolute -inset-1/2 opacity-15" : "hero-light-drift absolute -inset-1/2"} style={{ background: "linear-gradient(112deg, transparent 38%, rgb(184 155 98 / 0.12) 47%, rgb(245 225 176 / 0.16) 50%, rgb(184 155 98 / 0.08) 53%, transparent 62%)", filter: "blur(20px)" }} />
      {!reduceMotion && particles.map((particle) => (
        <span key={particle.left} className="hero-particle absolute rounded-full bg-[#d6b979] shadow-[0_0_12px_3px_rgba(184,155,98,0.3)]" style={{ left: particle.left, top: particle.top, width: particle.size, height: particle.size, animationDelay: particle.delay }} />
      ))}
    </div>
  );
}
