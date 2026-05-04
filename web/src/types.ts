export type ChatRole = "user" | "assistant" | "system";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

export type CitationSummary = {
  index: number;
  sourceFile: string;
  chunkIndex: number | string;
  score: number;
  preview80: string;
};

export type ApiErrorBody = {
  error?: { code?: string; message?: string };
};
