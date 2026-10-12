import { postJson } from '../api/client';
import type { Source } from './useChatStore';

export const MAX_QUESTION = 1000;

export interface AnswerResponse {
  answer: string;
  sources: Source[];
  has_sufficient_context: boolean;
}

export const askGuide = (question: string) => postJson<AnswerResponse>('/api/rag/answers', { question });
