"use client";

import { useRef, KeyboardEvent } from "react";
import { Send, Square, Paperclip, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { FileAttachment } from "@/types";

interface ChatInputProps {
  isDark: boolean;
  isLoading: boolean;
  onSend: (message: string, attachments?: FileAttachment[]) => void;
  onStop: () => void;
  value: string;
  onChange: (v: string) => void;
  attachments: FileAttachment[];
  onAttach: (files: FileAttachment[]) => void;
  onRemoveAttachment: (name: string) => void;
}

export default function ChatInput({
  isDark, isLoading, onSend, onStop, value, onChange,
  attachments, onAttach, onRemoveAttachment,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && value.trim()) handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
    }
  };

  const handleSend = () => {
    if (!isLoading && value.trim()) {
      onSend(value.trim(), attachments.length ? attachments : undefined);
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const newAttachments: FileAttachment[] = await Promise.all(
      files.map(
        (f) =>
          new Promise<FileAttachment>((resolve) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({ name: f.name, size: f.size, type: f.type, content: reader.result as string });
            reader.readAsText(f);
          })
      )
    );
    onAttach(newAttachments);
    e.target.value = "";
  };

  const canSend = !isLoading && value.trim().length > 0;

  return (
    <div
      className={cn(
        "border-t px-4 py-3",
        isDark ? "bg-gray-950 border-gray-800/60" : "bg-white border-gray-200/80"
      )}
      role="region"
      aria-label="Message input"
    >
      <div className="max-w-3xl mx-auto">
        {/* Attachments */}
        <AnimatePresence>
          {attachments.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-wrap gap-2 mb-2.5 overflow-hidden"
              aria-label="Attached files"
            >
              {attachments.map((a) => (
                <div
                  key={a.name}
                  className={cn(
                    "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl border font-medium",
                    isDark
                      ? "bg-gray-800/80 border-gray-700/60 text-gray-300"
                      : "bg-gray-100 border-gray-200 text-gray-700"
                  )}
                >
                  <Paperclip className="w-3 h-3 opacity-60" aria-hidden="true" />
                  <span className="max-w-[120px] truncate">{a.name}</span>
                  <button
                    onClick={() => onRemoveAttachment(a.name)}
                    aria-label={`Remove ${a.name}`}
                    className={cn(
                      "ml-0.5 rounded-full p-0.5 transition-colors",
                      isDark ? "hover:text-red-400 hover:bg-red-400/10" : "hover:text-red-500 hover:bg-red-50"
                    )}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input box */}
        <div
          className={cn(
            "flex items-end gap-2 rounded-2xl border px-3 py-2 transition-all duration-200",
            isDark
              ? "bg-gray-900/80 border-gray-700/60 focus-within:border-violet-500/50 focus-within:shadow-[0_0_0_3px_rgba(139,92,246,0.08)]"
              : "bg-gray-50 border-gray-200 focus-within:border-violet-400/70 focus-within:shadow-[0_0_0_3px_rgba(139,92,246,0.06)] focus-within:bg-white"
          )}
        >
          {/* File attach */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.pdf,.md,.json,.csv"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Attach files"
            tabIndex={-1}
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach file"
            disabled={isLoading}
            className={cn(
              "flex-shrink-0 p-1.5 rounded-xl transition-colors mb-0.5 focus:outline-none focus:ring-2 focus:ring-violet-500/50",
              isDark
                ? "text-gray-600 hover:text-gray-300 hover:bg-gray-800"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-200",
              "disabled:opacity-30 disabled:cursor-not-allowed"
            )}
          >
            <Paperclip className="w-4 h-4" />
          </motion.button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask about resumes, AI/ML concepts..."
            rows={1}
            disabled={isLoading}
            aria-label="Message input"
            aria-multiline="true"
            className={cn(
              "flex-1 resize-none bg-transparent text-sm outline-none py-1.5 max-h-40 leading-relaxed",
              "placeholder:font-normal disabled:opacity-40",
              isDark
                ? "text-gray-100 placeholder:text-gray-600"
                : "text-gray-900 placeholder:text-gray-400"
            )}
          />

          {/* Send / Stop */}
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={isLoading ? onStop : handleSend}
            disabled={!isLoading && !value.trim()}
            aria-label={isLoading ? "Stop generation" : "Send message"}
            className={cn(
              "flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 mb-0.5",
              "focus:outline-none focus:ring-2 focus:ring-violet-500/50",
              isLoading
                ? "bg-red-500 hover:bg-red-600 text-white shadow-sm shadow-red-500/30"
                : canSend
                  ? "bg-gradient-to-br from-violet-600 to-blue-600 text-white hover:opacity-90 shadow-md shadow-violet-500/25"
                  : isDark
                    ? "bg-gray-800 text-gray-700 cursor-not-allowed"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
            )}
          >
            {isLoading
              ? <Square className="w-3 h-3 fill-current" />
              : <Send className="w-3.5 h-3.5" />
            }
          </motion.button>
        </div>

        {/* Hint */}
        <p className={cn(
          "text-[10px] text-center mt-2 font-medium",
          isDark ? "text-gray-700" : "text-gray-400"
        )}>
          Enter to send · Shift+Enter for new line · Attach .txt, .md, .json files
        </p>
      </div>
    </div>
  );
}
