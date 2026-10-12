import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useOnline } from './useOnline';

describe('useOnline', () => {
  it('follows the browser online / offline events', () => {
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(false);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(true);
  });
});
