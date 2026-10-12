import { postJson } from '../api/client';
import type { Source } from './useChatStore';

export const MAX_QUESTION = 1000;
export const TIMEOUT_MS = 30_000;
export const SUGGESTED_QUESTIONS = [
  'How do I search in plain language?',
  'How do I filter by price?',
  'How do I see if a book is in stock?',
];

export interface AnswerResponse {
  answer: string;
  sources: Source[];
  has_sufficient_context: boolean;
}

export interface FeedbackBody {
  question: string;
  answer: string;
  helpful: boolean;
  comment?: string;
}

export const chatApi = {
  ask: (question: string, history: string[] = [], signal?: AbortSignal) =>
    postJson<AnswerResponse>('/api/rag/answers', { question, history }, signal),
  feedback: (body: FeedbackBody) => postJson<{ detail: string }>('/api/rag/feedback', body),
};

export type ChatApi = typeof chatApi;
