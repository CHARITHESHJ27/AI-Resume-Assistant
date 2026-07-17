"use client";

import { useRef, KeyboardEvent } from "react";
import { Send, Square, Paperclip, X } from "lucide-react";
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

  return (
    <div
      className={cn("border-t px-4 py-3", isDark ? "bg-gray-950 border-gray-800" : "bg-white border-gray-200")}
      role="region"
      aria-label="Message input"
    >
      <div className="max-w-4xl mx-auto">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2" aria-label="Attached files">
            {attachments.map((a) => (
              <div
                key={a.name}
                className={cn(
                  "flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border",
                  isDark ? "bg-gray-800 border-gray-700 text-gray-300" : "bg-gray-100 border-gray-200 text-gray-700"
                )}
              >
                <Paperclip className="w-3 h-3" aria-hidden="true" />
                <span className="max-w-[120px] truncate">{a.name}</span>
                <button
                  onClick={() => onRemoveAttachment(a.name)}
                  aria-label={`Remove ${a.name}`}
                  className="hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          className={cn(
            "flex items-end gap-2 rounded-2xl border px-4 py-2 transition-colors",
            isDark
              ? "bg-gray-900 border-gray-700 focus-within:border-violet-500/50"
              : "bg-gray-50 border-gray-200 focus-within:border-violet-400"
          )}
        >
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
          <button
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach file"
            disabled={isLoading}
            className={cn(
              "flex-shrink-0 p-1.5 rounded-lg transition-colors mb-0.5 focus:outline-none focus:ring-2 focus:ring-violet-500",
              isDark ? "text-gray-500 hover:text-gray-300 hover:bg-gray-800" : "text-gray-400 hover:text-gray-600 hover:bg-gray-200",
              "disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            <Paperclip className="w-4 h-4" />
          </button>

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
              "flex-1 resize-none bg-transparent text-sm outline-none py-1.5 max-h-40",
              "placeholder:text-gray-400 disabled:opacity-50 focus:outline-none",
              isDark ? "text-gray-100" : "text-gray-900"
            )}
          />

          <button
            onClick={isLoading ? onStop : handleSend}
            disabled={!isLoading && !value.trim()}
            aria-label={isLoading ? "Stop generation" : "Send message"}
            className={cn(
              "flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all mb-0.5",
              "focus:outline-none focus:ring-2 focus:ring-violet-500",
              isLoading
                ? "bg-red-500 hover:bg-red-600 text-white"
                : value.trim()
                  ? "bg-gradient-to-br from-violet-600 to-blue-600 text-white hover:opacity-90 shadow-sm"
                  : isDark
                    ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
            )}
          >
            {isLoading ? <Square className="w-3.5 h-3.5 fill-current" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
        <p className={cn("text-[10px] text-center mt-2", isDark ? "text-gray-700" : "text-gray-400")}>
          Enter to send · Shift+Enter for new line · Attach .txt, .md, .json files
        </p>
      </div>
    </div>
  );
}
