"use client";

import { Moon, Sun, Sparkles, Trash2, Download, PanelLeft } from "lucide-react";
import { motion } from "framer-motion";
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
        "sticky top-0 z-50 border-b backdrop-blur-xl",
        isDark
          ? "bg-gray-950/90 border-gray-800/60"
          : "bg-white/90 border-gray-200/80"
      )}
      role="banner"
    >
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        {/* Left — sidebar toggle + logo */}
        <div className="flex items-center gap-3 min-w-0">
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={onToggleSidebar}
            aria-label={sidebarOpen ? "Close conversation history" : "Open conversation history"}
            aria-expanded={sidebarOpen}
            className={cn(
              "p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/60 flex-shrink-0",
              isDark
                ? "text-gray-500 hover:text-gray-200 hover:bg-gray-800/80"
                : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
            )}
          >
            <PanelLeft className="w-4 h-4" />
          </motion.button>

          <div className="flex items-center gap-2.5 min-w-0">
            {/* Logo */}
            <div
              className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 via-purple-500 to-blue-500 flex items-center justify-center shadow-md shadow-violet-500/20 flex-shrink-0"
              aria-hidden="true"
            >
              <Sparkles className="w-4 h-4 text-white" />
            </div>

            <div className="min-w-0">
              <h1 className={cn(
                "text-sm font-semibold tracking-tight leading-none truncate",
                isDark ? "text-white" : "text-gray-900"
              )}>
                AI Resume Assistant
              </h1>
              <p className={cn(
                "text-[11px] mt-0.5 leading-none font-medium tracking-wide",
                isDark ? "text-gray-500" : "text-gray-400"
              )}>
                4-Agent · LangGraph
              </p>
            </div>
          </div>
        </div>

        {/* Right — actions */}
        <nav className="flex items-center gap-0.5 flex-shrink-0" aria-label="Chat actions">
          {messageCount > 0 && (
            <>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={onExport}
                aria-label="Export conversation"
                className={cn(
                  "h-8 px-2.5 rounded-lg transition-colors text-xs flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500/60 font-medium",
                  isDark
                    ? "text-gray-500 hover:text-emerald-400 hover:bg-emerald-400/10"
                    : "text-gray-400 hover:text-emerald-600 hover:bg-emerald-50"
                )}
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export</span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={onClearChat}
                aria-label="Clear conversation"
                className={cn(
                  "h-8 px-2.5 rounded-lg transition-colors text-xs flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500/60 font-medium",
                  isDark
                    ? "text-gray-500 hover:text-red-400 hover:bg-red-400/10"
                    : "text-gray-400 hover:text-red-500 hover:bg-red-50"
                )}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </motion.button>
            </>
          )}

          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={onToggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className={cn(
              "h-8 w-8 rounded-lg transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-violet-500/60",
              isDark
                ? "text-gray-500 hover:text-yellow-400 hover:bg-yellow-400/10"
                : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
            )}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </motion.button>
        </nav>
      </div>
    </header>
  );
}
