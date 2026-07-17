"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Message } from "@/types";
import { cn, formatTime, AGENT_COLORS, AGENT_ICONS } from "@/lib/utils";
import TypingIndicator from "./TypingIndicator";

interface MessageBubbleProps {
  message: Message;
  isDark: boolean;
}

function CopyButton({ text, isDark }: { text: string; isDark: boolean }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      aria-label={copied ? "Copied" : "Copy message"}
      className={cn(
        "opacity-0 group-hover:opacity-100 transition-all p-1 rounded",
        isDark ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"
      )}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function AgentBadge({ agent, isDark }: { agent: string; isDark: boolean }) {
  const colorClass = AGENT_COLORS[agent] ?? AGENT_COLORS["AI Assistant"];
  const icon = AGENT_ICONS[agent] ?? "✨";
  return (
    <span
      role="status"
      aria-label={`Responded by ${agent}`}
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border",
        colorClass,
        isDark ? "" : "bg-opacity-20"
      )}
    >
      <span aria-hidden="true">{icon}</span>
      {agent}
    </span>
  );
}

export default function MessageBubble({ message, isDark }: MessageBubbleProps) {
  const isUser = message.role === "user";

  if (message.isStreaming && message.content === "") {
    return (
      <div className="flex items-end gap-2 max-w-[85%]">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 bg-gradient-to-br from-violet-500 to-blue-500 text-white">
          AI
        </div>
        <div className={cn("px-4 py-3 rounded-2xl rounded-bl-sm", isDark ? "bg-gray-800" : "bg-gray-100")}>
          <TypingIndicator isDark={isDark} />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn("flex items-end gap-2 group", isUser ? "flex-row-reverse ml-auto max-w-[85%]" : "max-w-[85%]")}
    >
      <div
        aria-hidden="true"
        className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 mb-0.5",
          isUser
            ? "bg-gradient-to-br from-violet-500 to-pink-500 text-white"
            : "bg-gradient-to-br from-violet-500 to-blue-500 text-white"
        )}
      >
        {isUser ? "U" : "AI"}
      </div>

      <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
        {!isUser && message.agent && message.agent !== "Assistant" && (
          <AgentBadge agent={message.agent} isDark={isDark} />
        )}

        <div
          role={isUser ? "none" : "article"}
          aria-label={isUser ? undefined : "AI response"}
          className={cn(
            "relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
            isUser
              ? "bg-gradient-to-br from-violet-600 to-blue-600 text-white rounded-br-sm"
              : cn("rounded-bl-sm", isDark ? "bg-gray-800 text-gray-100" : "bg-gray-100 text-gray-900")
          )}
        >
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <ReactMarkdown
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const isBlock = !!match;
                  return isBlock ? (
                    <SyntaxHighlighter
                      style={isDark ? oneDark : oneLight}
                      language={match[1]}
                      PreTag="div"
                      className="rounded-lg text-xs my-2 overflow-x-auto"
                    >
                      {String(children).replace(/\n$/, "")}
                    </SyntaxHighlighter>
                  ) : (
                    <code
                      className={cn(
                        "px-1 py-0.5 rounded text-xs font-mono",
                        isDark ? "bg-gray-700 text-emerald-400" : "bg-gray-200 text-emerald-700"
                      )}
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 my-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 my-1">{children}</ol>,
                li: ({ children }) => <li className="text-sm">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                h3: ({ children }) => <h3 className="font-semibold text-sm mt-2 mb-1">{children}</h3>,
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
          {message.isStreaming && (
            <span className="inline-block w-0.5 h-4 bg-current ml-0.5 animate-pulse align-middle" aria-hidden="true" />
          )}
        </div>

        <div className={cn("flex items-center gap-1.5 px-1", isUser ? "flex-row-reverse" : "flex-row")}>
          <span className={cn("text-[10px]", isDark ? "text-gray-600" : "text-gray-400")}>
            {formatTime(message.timestamp)}
          </span>
          {!isUser && !message.isStreaming && <CopyButton text={message.content} isDark={isDark} />}
        </div>
      </div>
    </motion.div>
  );
}
