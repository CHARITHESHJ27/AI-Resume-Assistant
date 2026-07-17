"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Plus, X } from "lucide-react";
import { Message, AgentType, Conversation, FileAttachment } from "@/types";
import { streamChat, createUserMessage, createAssistantPlaceholder } from "@/lib/api";
import { generateId, cn, formatTime } from "@/lib/utils";
import Header from "./Header";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";

function ConversationSidebar({
  isDark,
  conversations,
  activeId,
  onSelect,
  onNew,
  onClose,
}: {
  isDark: boolean;
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  return (
    <motion.aside
      initial={{ x: -280 }}
      animate={{ x: 0 }}
      exit={{ x: -280 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={cn(
        "fixed left-0 top-0 h-full w-64 z-40 flex flex-col border-r shadow-xl",
        isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"
      )}
      aria-label="Conversation history"
      role="navigation"
    >
      <div className={cn("flex items-center justify-between px-4 h-14 border-b flex-shrink-0", isDark ? "border-gray-800" : "border-gray-200")}>
        <span className={cn("text-sm font-semibold", isDark ? "text-white" : "text-gray-900")}>Conversations</span>
        <button
          onClick={onClose}
          aria-label="Close sidebar"
          className={cn("p-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500", isDark ? "text-gray-400 hover:text-white hover:bg-gray-800" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100")}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <button
        onClick={onNew}
        className={cn(
          "mx-3 mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500",
          "bg-gradient-to-br from-violet-600 to-blue-600 text-white hover:opacity-90"
        )}
        aria-label="Start new conversation"
      >
        <Plus className="w-4 h-4" />
        New Chat
      </button>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1" role="list" aria-label="Previous conversations">
        {conversations.length === 0 && (
          <p className={cn("text-xs text-center mt-8", isDark ? "text-gray-600" : "text-gray-400")}>No conversations yet</p>
        )}
        {conversations.map((c) => (
          <button
            key={c.id}
            role="listitem"
            onClick={() => onSelect(c.id)}
            aria-current={c.id === activeId ? "page" : undefined}
            className={cn(
              "w-full text-left px-3 py-2.5 rounded-xl text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500",
              c.id === activeId
                ? isDark ? "bg-violet-500/20 text-violet-300" : "bg-violet-50 text-violet-700"
                : isDark ? "text-gray-400 hover:bg-gray-800 hover:text-gray-200" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            )}
          >
            <div className="flex items-center gap-2 mb-0.5">
              <MessageSquare className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
              <span className="font-medium truncate">{c.title}</span>
            </div>
            <span className={cn("text-[10px] pl-5", isDark ? "text-gray-600" : "text-gray-400")}>
              {formatTime(c.updatedAt)} · {c.messages.length} messages
            </span>
          </button>
        ))}
      </div>
    </motion.aside>
  );
}

function makeTitle(messages: Message[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New conversation";
  return first.content.slice(0, 40) + (first.content.length > 40 ? "…" : "");
}

export default function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const saveConversation = useCallback((msgs: Message[]) => {
    if (msgs.length === 0) return;
    setConversations((prev) => {
      const existing = prev.find((c) => c.id === activeConvId);
      if (existing) {
        return prev.map((c) =>
          c.id === activeConvId ? { ...c, messages: msgs, title: makeTitle(msgs), updatedAt: new Date() } : c
        );
      }
      const newConv: Conversation = {
        id: activeConvId ?? generateId(),
        title: makeTitle(msgs),
        messages: msgs,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setActiveConvId(newConv.id);
      return [newConv, ...prev];
    });
  }, [activeConvId]);

  const sendMessage = useCallback(async (content: string, files?: FileAttachment[]) => {
    if (isLoading) return;
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userMsg = createUserMessage(content);
    if (files?.length) userMsg.attachments = files;
    const placeholder = createAssistantPlaceholder();

    const nextMessages = [...messages, userMsg, placeholder];
    setMessages(nextMessages);
    setInput("");
    setAttachments([]);
    setIsLoading(true);

    await streamChat(
      [...messages, userMsg],
      (token) => {
        if (controller.signal.aborted) return;
        setMessages((prev) =>
          prev.map((m) => m.id === placeholder.id ? { ...m, content: m.content + token } : m)
        );
      },
      (agent: AgentType, queryType: string) => {
        if (controller.signal.aborted) return;
        setMessages((prev) =>
          prev.map((m) => m.id === placeholder.id ? { ...m, agent, queryType } : m)
        );
      },
      () => {
        setMessages((prev) => {
          const final = prev.map((m) => m.id === placeholder.id ? { ...m, isStreaming: false } : m);
          saveConversation(final);
          return final;
        });
        setIsLoading(false);
      },
      (msg) => {
        setError(msg);
        setMessages((prev) => prev.filter((m) => m.id !== placeholder.id));
        setIsLoading(false);
      },
      controller.signal
    );
  }, [isLoading, messages, saveConversation]);

  const handleStop = () => {
    abortControllerRef.current?.abort();
    setMessages((prev) => prev.map((m) => m.isStreaming ? { ...m, isStreaming: false } : m));
    setIsLoading(false);
  };

  const handleClear = () => {
    setMessages([]);
    setError(null);
    setActiveConvId(null);
  };

  const handleExport = () => {
    const text = messages
      .map((m) => `[${m.role.toUpperCase()}${m.agent ? ` · ${m.agent}` : ""}]\n${m.content}`)
      .join("\n\n---\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSelectConversation = (id: string) => {
    const conv = conversations.find((c) => c.id === id);
    if (conv) {
      setMessages(conv.messages);
      setActiveConvId(id);
      setSidebarOpen(false);
      setError(null);
    }
  };

  const handleNewChat = () => {
    handleClear();
    setSidebarOpen(false);
  };

  return (
    <div className={cn("flex flex-col h-screen relative overflow-hidden", isDark ? "bg-gray-950 text-gray-100" : "bg-white text-gray-900")}>
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
            <ConversationSidebar
              isDark={isDark}
              conversations={conversations}
              activeId={activeConvId}
              onSelect={handleSelectConversation}
              onNew={handleNewChat}
              onClose={() => setSidebarOpen(false)}
            />
          </>
        )}
      </AnimatePresence>

      <Header
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
        onClearChat={handleClear}
        onExport={handleExport}
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
        messageCount={messages.length}
        sidebarOpen={sidebarOpen}
      />

      <main className="flex-1 flex flex-col overflow-hidden" role="main" aria-label="Chat interface">
        <MessageList
          messages={messages}
          isDark={isDark}
          onSampleQuery={(q) => { setInput(q); sendMessage(q); }}
        />

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="max-w-4xl mx-auto w-full px-4 pb-2"
              role="alert"
              aria-live="assertive"
            >
              <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                ⚠ {error}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <ChatInput
          isDark={isDark}
          isLoading={isLoading}
          onSend={sendMessage}
          onStop={handleStop}
          value={input}
          onChange={setInput}
          attachments={attachments}
          onAttach={(files) => setAttachments((prev) => [...prev, ...files])}
          onRemoveAttachment={(name) => setAttachments((prev) => prev.filter((a) => a.name !== name))}
        />
      </main>
    </div>
  );
}
