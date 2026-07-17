"use client";

import { useRef, useEffect } from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { Message } from "@/types";
import MessageBubble from "./MessageBubble";
import { cn } from "@/lib/utils";
import { Bot, FileText, Cpu } from "lucide-react";
import { SAMPLE_QUERIES } from "@/lib/utils";

interface MessageListProps {
  messages: Message[];
  isDark: boolean;
  onSampleQuery: (query: string) => void;
}

function WelcomeScreen({ isDark, onSampleQuery }: { isDark: boolean; onSampleQuery: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center mb-5 shadow-lg">
        <Bot className="w-8 h-8 text-white" aria-hidden="true" />
      </div>
      <h2 className={cn("text-xl font-semibold mb-2", isDark ? "text-white" : "text-gray-900")}>
        AI Resume Assistant
      </h2>
      <p className={cn("text-sm max-w-sm mb-8", isDark ? "text-gray-400" : "text-gray-500")}>
        Powered by 3 specialized agents — ask about resumes, careers, or any AI/ML topic.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg mb-8" role="list" aria-label="Available agents">
        {[
          { icon: <FileText className="w-4 h-4 text-violet-400" />, name: "Resume RAG Agent", desc: "Searches anonymized resume data to answer career & skills questions" },
          { icon: <Cpu className="w-4 h-4 text-blue-400" />, name: "General AI Agent", desc: "Explains AI/ML concepts, compares frameworks, and discusses trends" },
        ].map((a) => (
          <div
            key={a.name}
            role="listitem"
            className={cn("p-3 rounded-xl border text-left", isDark ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200")}
          >
            <div className="flex items-center gap-2 mb-1">
              {a.icon}
              <span className={cn("text-xs font-semibold", isDark ? "text-gray-200" : "text-gray-700")}>{a.name}</span>
            </div>
            <p className={cn("text-xs", isDark ? "text-gray-500" : "text-gray-400")}>{a.desc}</p>
          </div>
        ))}
      </div>

      <p className={cn("text-xs font-medium mb-3", isDark ? "text-gray-500" : "text-gray-400")}>TRY ASKING</p>
      <div className="flex flex-wrap gap-2 justify-center max-w-lg" role="list" aria-label="Sample queries">
        {SAMPLE_QUERIES.map((sq) => (
          <button
            key={sq.query}
            role="listitem"
            onClick={() => onSampleQuery(sq.query)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500",
              sq.type === "resume"
                ? isDark ? "border-violet-500/30 text-violet-400 hover:bg-violet-500/10" : "border-violet-300 text-violet-600 hover:bg-violet-50"
                : isDark ? "border-blue-500/30 text-blue-400 hover:bg-blue-500/10" : "border-blue-300 text-blue-600 hover:bg-blue-50"
            )}
          >
            {sq.label}
          </button>
        ))}
      </div>
    </div>
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
        <div className="max-w-4xl mx-auto px-4 py-2">
          <MessageBubble message={msg} isDark={isDark} />
        </div>
      )}
      components={{
        Footer: () => <div className="h-4" />,
      }}
    />
  );
}
