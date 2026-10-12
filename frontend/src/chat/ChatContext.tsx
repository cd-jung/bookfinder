import { createContext, useCallback, useMemo, useState, type ReactNode } from 'react';

export interface ChatControl {
  open: boolean;
  /** Text to put in the input when the panel opens (e.g. from the empty results shortcut). */
  prefill: string;
  openChat: (prefill?: string) => void;
  closeChat: () => void;
  consumePrefill: () => void;
}

export const ChatContext = createContext<ChatControl | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState('');
  const openChat = useCallback((text = '') => {
    setPrefill(text);
    setOpen(true);
  }, []);
  const closeChat = useCallback(() => setOpen(false), []);
  const consumePrefill = useCallback(() => setPrefill(''), []);
  const value = useMemo(() => ({ open, prefill, openChat, closeChat, consumePrefill }), [open, prefill, openChat, closeChat, consumePrefill]);
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
