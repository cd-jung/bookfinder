import { useContext } from 'react';
import { ChatContext, type ChatControl } from './ChatContext';

/** Open / close the Help panel from anywhere. Outside a provider it is inert (tests of single pages). */
export function useChat(): ChatControl {
  return (
    useContext(ChatContext) ?? { open: false, prefill: '', openChat: () => {}, closeChat: () => {}, consumePrefill: () => {} }
  );
}
