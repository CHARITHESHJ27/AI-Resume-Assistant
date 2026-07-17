"use client";

import { Moon, Sun, Bot, Trash2, Download, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onClearChat: () => void;
  onExport: () => void;
  onToggleSidebar: () => void;
  messageCount: number;
  sidebarOpen: boolean;
}

export default function Header({
  isDark, onToggleTheme, onClearChat, onExport,
  onToggleSidebar, messageCount, sidebarOpen,
}: HeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b backdrop-blur-md",
        isDark ? "bg-gray-950/80 border-gray-800" : "bg-white/80 border-gray-200"
      )}
      role="banner"
    >
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onToggleSidebar}
            aria-label={sidebarOpen ? "Close conversation history" : "Open conversation history"}
            aria-expanded={sidebarOpen}
            className={cn(
              "p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500",
              isDark ? "text-gray-400 hover:text-gray-200 hover:bg-gray-800" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
            )}
          >
            <PanelLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-sm" aria-hidden="true">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className={cn("text-sm font-semibold leading-none", isDark ? "text-white" : "text-gray-900")}>
                AI Resume Assistant
              </h1>
              <p className={cn("text-xs mt-0.5", isDark ? "text-gray-400" : "text-gray-500")}>
                Multi-Agent · LangGraph
              </p>
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-1" aria-label="Chat actions">
          {messageCount > 0 && (
            <>
              <button
                onClick={onExport}
                aria-label="Export conversation"
                className={cn(
                  "p-2 rounded-lg transition-colors text-xs flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500",
                  isDark ? "text-gray-400 hover:text-emerald-400 hover:bg-emerald-400/10" : "text-gray-500 hover:text-emerald-600 hover:bg-emerald-50"
                )}
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
              </button>
              <button
                onClick={onClearChat}
                aria-label="Clear conversation"
                className={cn(
                  "p-2 rounded-lg transition-colors text-xs flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500",
                  isDark ? "text-gray-400 hover:text-red-400 hover:bg-red-400/10" : "text-gray-500 hover:text-red-500 hover:bg-red-50"
                )}
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            </>
          )}
          <button
            onClick={onToggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className={cn(
              "p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500",
              isDark ? "text-gray-400 hover:text-yellow-400 hover:bg-yellow-400/10" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
            )}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </nav>
      </div>
    </header>
  );
}
