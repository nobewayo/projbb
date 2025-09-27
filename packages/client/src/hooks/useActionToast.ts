// @module: ui-feedback
// @tags: toast, hooks, ui

import { useCallback, useEffect, useRef, useState } from 'react';

export type ActionToast = {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
};

export interface UseActionToastResult {
  toast: ActionToast | null;
  showToast: (message: string, tone: 'success' | 'error' | 'info') => void;
  dismissToast: () => void;
}

export const useActionToast = (timeoutMs = 4000): UseActionToastResult => {
  const [toast, setToast] = useState<ActionToast | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismissToast = useCallback(() => {
    clearTimer();
    setToast(null);
  }, [clearTimer]);

  const showToast = useCallback(
    (message: string, tone: 'success' | 'error' | 'info') => {
      clearTimer();
      setToast({ id: Date.now(), message, tone });
      timerRef.current = window.setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, timeoutMs);
    },
    [clearTimer, timeoutMs],
  );

  useEffect(() => dismissToast, [dismissToast]);

  return { toast, showToast, dismissToast };
};
