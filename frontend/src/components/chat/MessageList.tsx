"use client";

import { useRef, useEffect } from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { motion } from "framer-motion";
import { Message } from "@/types";
import MessageBubble from "./MessageBubble";
import { cn } from "@/lib/utils";
import { Sparkles, FileText, Cpu } from "lucide-react";
import { SAMPLE_QUERIES } from "@/lib/utils";

interface MessageListProps {
  messages: Message[];
  isDark: boolean;
  onSampleQuery: (query: string) => void;
}

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } },
};

function WelcomeScreen({ isDark, onSampleQuery }: { isDark: boolean; onSampleQuery: (q: string) => void }) {
  const agents = [
    {
      icon: <FileText className="w-4 h-4" />,
      name: "Resume RAG Agent",
      desc: "Searches anonymized resume data to answer career, skills, and job-related questions",
      color: "text-violet-400",
      bg: isDark ? "bg-violet-500/8 border-violet-500/20 hover:border-violet-500/40" : "bg-violet-50/80 border-violet-200 hover:border-violet-300",
    },
    {
      icon: <Cpu className="w-4 h-4" />,
      name: "General AI Agent",
      desc: "Explains AI/ML concepts, compares frameworks, architectures, and deployment practices",
      color: "text-blue-400",
      bg: isDark ? "bg-blue-500/8 border-blue-500/20 hover:border-blue-500/40" : "bg-blue-50/80 border-blue-200 hover:border-blue-300",
    },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="flex flex-col items-center justify-center h-full px-4 py-10 text-center"
    >
      {/* Logo */}
      <motion.div variants={itemVariants}>
        <div className="relative mb-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-blue-500 flex items-center justify-center shadow-xl shadow-violet-500/25">
            <Sparkles className="w-8 h-8 text-white" aria-hidden="true" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-current flex items-center justify-center">
            <span className="text-[8px] text-white font-bold">4</span>
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <h2 className={cn("text-2xl font-bold tracking-tight mb-2", isDark ? "text-white" : "text-gray-900")}>
          AI Resume Assistant
        </h2>
        <p className={cn("text-sm max-w-xs mx-auto leading-relaxed", isDark ? "text-gray-400" : "text-gray-500")}>
          Powered by 4 specialized agents — ask about resumes, careers, or any AI/ML topic.
        </p>
      </motion.div>

      {/* Agent cards */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl mt-8 mb-7"
        role="list"
        aria-label="Available agents"
      >
        {agents.map((a) => (
          <motion.div
            key={a.name}
            role="listitem"
            whileHover={{ y: -2, transition: { duration: 0.15 } }}
            className={cn(
              "p-4 rounded-2xl border text-left transition-all duration-200 cursor-default",
              a.bg
            )}
          >
            <div className={cn("flex items-center gap-2 mb-2", a.color)}>
              {a.icon}
              <span className={cn(
                "text-xs font-semibold tracking-tight",
                isDark ? "text-gray-200" : "text-gray-800"
              )}>
                {a.name}
              </span>
            </div>
            <p className={cn("text-xs leading-relaxed", isDark ? "text-gray-500" : "text-gray-500")}>
              {a.desc}
            </p>
          </motion.div>
        ))}
      </motion.div>

      {/* Sample queries */}
      <motion.div variants={itemVariants} className="w-full max-w-2xl">
        <p className={cn(
          "text-[10px] font-semibold tracking-widest uppercase mb-3",
          isDark ? "text-gray-600" : "text-gray-400"
        )}>
          Try asking
        </p>
        <div
          className="flex flex-wrap gap-2 justify-center"
          role="list"
          aria-label="Sample queries"
        >
          {SAMPLE_QUERIES.map((sq) => (
            <motion.button
              key={sq.query}
              role="listitem"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSampleQuery(sq.query)}
              className={cn(
                "text-xs px-3.5 py-1.5 rounded-full border font-medium transition-all duration-150",
                "focus:outline-none focus:ring-2 focus:ring-violet-500/50",
                sq.type === "resume"
                  ? isDark
                    ? "border-violet-500/25 text-violet-400 hover:bg-violet-500/12 hover:border-violet-500/40"
                    : "border-violet-200 text-violet-600 hover:bg-violet-50 hover:border-violet-300"
                  : isDark
                    ? "border-blue-500/25 text-blue-400 hover:bg-blue-500/12 hover:border-blue-500/40"
                    : "border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300"
              )}
            >
              {sq.label}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function MessageList({ messages, isDark, onSampleQuery }: MessageListProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  useEffect(() => {
    if (messages.length > 0) {
      virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, behavior: "smooth" });
    }
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <WelcomeScreen isDark={isDark} onSampleQuery={onSampleQuery} />
      </div>
    );
  }

  return (
    <Virtuoso
      ref={virtuosoRef}
      data={messages}
      style={{ flex: 1 }}
      followOutput="smooth"
      aria-label="Chat messages"
      aria-live="polite"
      itemContent={(_, msg) => (
        <div className="max-w-3xl mx-auto px-4 py-1.5">
          <MessageBubble message={msg} isDark={isDark} />
        </div>
      )}
      components={{
        Header: () => <div className="h-4" />,
        Footer: () => <div className="h-4" />,
      }}
    />
  );
}
