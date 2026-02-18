export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatSession {
  sessionId: string;
  title?: string;
  createdAt: number;
  messages: Message[];
}

export interface UserProfile {
  userId: string;
  email: string;
  name: string;
  createdAt: number;
  lastUpdated: number;
  facts: Record<string, unknown>;
}

export interface ChatRequest {
  message: string;
  sessionId: string;
}

export interface ChatResponse {
  reply: string;
  sessionId: string;
}
