export type Role = "user" | "assistant";

export type AgentType = "Resume RAG Agent" | "General AI Agent" | "AI Assistant" | "Assistant";

export interface Message {
  id: string;
  role: Role;
  content: string;
  agent?: AgentType;
  queryType?: string;
  timestamp: Date;
  isStreaming?: boolean;
  attachments?: FileAttachment[];
}

export interface FileAttachment {
  name: string;
  size: number;
  type: string;
  content: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StreamEvent {
  type: "agent" | "token" | "done" | "error";
  content?: string;
  agent?: AgentType;
  query_type?: string;
  message?: string;
}
