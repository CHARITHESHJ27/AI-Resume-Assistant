"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function TypingIndicator({ isDark }: { isDark: boolean }) {
  return (
    <div className="flex items-center gap-1 py-0.5" aria-label="AI is typing">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className={cn("w-1.5 h-1.5 rounded-full", isDark ? "bg-gray-400" : "bg-gray-500")}
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}
