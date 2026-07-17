import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export const AGENT_COLORS: Record<string, string> = {
  "Resume RAG Agent": "bg-violet-500/10 text-violet-400 border-violet-500/20",
  "General AI Agent": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "AI Assistant": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "Assistant": "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

export const AGENT_ICONS: Record<string, string> = {
  "Resume RAG Agent": "📄",
  "General AI Agent": "🤖",
  "AI Assistant": "✨",
  "Assistant": "💬",
};

export const SAMPLE_QUERIES = [
  { label: "ML Engineer Skills", query: "What skills does a machine learning engineer typically have?", type: "resume" },
  { label: "CV Role Experience", query: "Show me experience examples for computer vision roles", type: "resume" },
  { label: "AI Certifications", query: "What certifications are common in AI engineering?", type: "resume" },
  { label: "Attention Mechanism", query: "How does the attention mechanism work in transformers?", type: "ai" },
  { label: "YOLO vs Faster R-CNN", query: "What is the difference between YOLO and Faster R-CNN?", type: "ai" },
  { label: "ML Deployment", query: "What are best practices for deploying ML models to production?", type: "ai" },
];
