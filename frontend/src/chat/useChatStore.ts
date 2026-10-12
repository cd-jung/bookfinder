import { useCallback, useEffect, useState } from 'react';

export interface Source {
  title: string;
  section: string;
  url: string;
  similarity: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: Source[];
  error?: boolean;
  stopped?: boolean;
  question?: string; // the question this message answers (Retry, feedback)
}

const KEY = 'help-chat-messages';

function load(): Message[] {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as Message[];
  } catch {
    return [];
  }
}

/** Conversation kept in sessionStorage: survives reloads in the same tab, gone when the tab closes. */
export function useChatStore() {
  const [messages, setMessages] = useState<Message[]>(load);

  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(messages));
    } catch {
      /* storage unavailable: keep the conversation in memory only */
    }
  }, [messages]);

  const add = useCallback((message: Omit<Message, 'id'>) => {
    setMessages((list) => [...list, { ...message, id: `${Date.now()}-${list.length}` }]);
  }, []);
  const removeLast = useCallback(() => setMessages((list) => list.slice(0, -1)), []);
  const clear = useCallback(() => setMessages([]), []);

  return { messages, add, removeLast, clear };
}
