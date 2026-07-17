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
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={handleCopy}
      aria-label={copied ? "Copied" : "Copy message"}
      className={cn(
        "opacity-0 group-hover:opacity-100 transition-all duration-150 p-1.5 rounded-md",
        isDark
          ? "text-gray-600 hover:text-gray-300 hover:bg-gray-700/60"
          : "text-gray-300 hover:text-gray-600 hover:bg-gray-100"
      )}
    >
      {copied
        ? <Check className="w-3 h-3 text-emerald-500" />
        : <Copy className="w-3 h-3" />
      }
    </motion.button>
  );
}

function AgentBadge({ agent, isDark }: { agent: string; isDark: boolean }) {
  const colorClass = AGENT_COLORS[agent] ?? AGENT_COLORS["AI Assistant"];
  const icon = AGENT_ICONS[agent] ?? "✨";
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      role="status"
      aria-label={`Responded by ${agent}`}
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border tracking-wide",
        colorClass,
        isDark ? "" : "bg-opacity-15"
      )}
    >
      <span aria-hidden="true" className="text-[9px]">{icon}</span>
      {agent}
    </motion.span>
  );
}

export default function MessageBubble({ message, isDark }: MessageBubbleProps) {
  const isUser = message.role === "user";

  if (message.isStreaming && message.content === "") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="flex items-end gap-2.5 max-w-[85%]"
      >
        <div className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 shadow-sm",
          "bg-gradient-to-br from-violet-500 to-blue-500 text-white"
        )}>
          AI
        </div>
        <div className={cn(
          "px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm",
          isDark ? "bg-gray-800/90 border border-gray-700/50" : "bg-white border border-gray-200"
        )}>
          <TypingIndicator isDark={isDark} />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        "flex items-end gap-2.5 group",
        isUser ? "flex-row-reverse ml-auto max-w-[78%]" : "mr-auto max-w-[85%]"
      )}
    >
      {/* Avatar */}
      <div
        aria-hidden="true"
        className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mb-0.5 shadow-sm",
          isUser
            ? "bg-gradient-to-br from-violet-500 to-pink-500 text-white"
            : "bg-gradient-to-br from-violet-500 to-blue-500 text-white"
        )}
      >
        {isUser ? "U" : "AI"}
      </div>

      <div className={cn("flex flex-col gap-1.5", isUser ? "items-end" : "items-start")}>
        {/* Agent badge */}
        {!isUser && message.agent && message.agent !== "Assistant" && (
          <AgentBadge agent={message.agent} isDark={isDark} />
        )}

        {/* Bubble */}
        <div
          role={isUser ? "none" : "article"}
          aria-label={isUser ? undefined : "AI response"}
          className={cn(
            "relative px-4 py-3 rounded-2xl text-sm leading-relaxed",
            isUser
              ? "bg-gradient-to-br from-violet-600 to-blue-600 text-white rounded-br-sm shadow-md shadow-violet-500/20"
              : cn(
                  "rounded-bl-sm shadow-sm",
                  isDark
                    ? "bg-gray-800/90 text-gray-100 border border-gray-700/50"
                    : "bg-white text-gray-800 border border-gray-200/80 shadow-gray-100"
                )
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
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
                      className="!rounded-xl !text-xs !my-3 overflow-x-auto"
                    >
                      {String(children).replace(/\n$/, "")}
                    </SyntaxHighlighter>
                  ) : (
                    <code
                      className={cn(
                        "px-1.5 py-0.5 rounded-md text-xs font-mono",
                        isDark ? "bg-gray-700/80 text-violet-300" : "bg-violet-50 text-violet-700"
                      )}
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-outside pl-4 space-y-1 my-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-outside pl-4 space-y-1 my-2">{children}</ol>,
                li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                h3: ({ children }) => <h3 className="font-semibold text-sm mt-3 mb-1.5">{children}</h3>,
                h2: ({ children }) => <h2 className="font-semibold text-base mt-3 mb-1.5">{children}</h2>,
                blockquote: ({ children }) => (
                  <blockquote className={cn(
                    "border-l-2 pl-3 my-2 italic",
                    isDark ? "border-violet-500/40 text-gray-400" : "border-violet-400/50 text-gray-500"
                  )}>
                    {children}
                  </blockquote>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}

          {/* Streaming cursor */}
          {message.isStreaming && (
            <span
              className="inline-block w-0.5 h-[1em] bg-current ml-0.5 align-middle cursor-blink"
              aria-hidden="true"
            />
          )}
        </div>

        {/* Timestamp + copy */}
        <div className={cn(
          "flex items-center gap-1.5 px-1",
          isUser ? "flex-row-reverse" : "flex-row"
        )}>
          <span className={cn(
            "text-[10px] font-medium tabular-nums",
            isDark ? "text-gray-600" : "text-gray-400"
          )}>
            {formatTime(message.timestamp)}
          </span>
          {!isUser && !message.isStreaming && (
            <CopyButton text={message.content} isDark={isDark} />
          )}
        </div>
      </div>
    </motion.div>
  );
}
