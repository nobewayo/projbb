import '@testing-library/jest-dom';
import { act, renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import { useActionToast } from '../useActionToast';

vi.useFakeTimers();

describe('useActionToast', () => {
  it('returns null by default', () => {
    const { result } = renderHook(() => useActionToast(1000));

    expect(result.current.toast).toBeNull();
  });

  it('exposes the latest toast and clears after the timeout', () => {
    const { result } = renderHook(() => useActionToast(1000));

    act(() => {
      result.current.showToast('Saved', 'success');
    });

    expect(result.current.toast).not.toBeNull();
    expect(result.current.toast?.message).toBe('Saved');

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.toast).toBeNull();
  });
});
