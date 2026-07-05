import { useCallback, useState } from 'react';

/** Whether the OS/browser is currently asking for reduced motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Reduced-motion preference with a manual override. Defaults to honoring the
 * system setting (`prefers-reduced-motion`), and the Observer can flip it either
 * way. Gating the decorative motion — the wear tremble, drifting motes, edge
 * pulses, transition flash — behind this keeps the piece watchable for people
 * who are motion-sensitive (an accessibility requirement of the brief).
 */
export function useReducedMotion(): { reduced: boolean; toggle: () => void } {
  const [reduced, setReduced] = useState<boolean>(() => prefersReducedMotion());
  const toggle = useCallback(() => setReduced((r) => !r), []);
  return { reduced, toggle };
}
