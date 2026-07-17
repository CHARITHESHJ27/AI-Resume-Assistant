"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function TypingIndicator({ isDark }: { isDark: boolean }) {
  return (
    <div
      className="flex items-center gap-1.5 py-0.5 px-0.5"
      aria-label="AI is thinking"
      role="status"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className={cn(
            "rounded-full",
            i === 1 ? "w-1.5 h-1.5" : "w-1 h-1",
            isDark ? "bg-violet-400/70" : "bg-violet-500/60"
          )}
          animate={{
            y: [0, -5, 0],
            opacity: [0.4, 1, 0.4],
          }}
          transition={{
            duration: 1.1,
            repeat: Infinity,
            delay: i * 0.18,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
