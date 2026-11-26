import { useEffect } from 'react';

/**
 * Keeps the screen on while you're at the table (phones otherwise dim and lock
 * during long games, and a locked iPhone also stops its camera). The browser
 * drops the lock whenever the page is hidden, so it's taken again on return.
 * Browsers without the Screen Wake Lock API simply ignore this.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || document.visibilityState !== 'visible' || (lock && !lock.released)) return;
      try {
        lock = await navigator.wakeLock.request('screen');
        if (cancelled) lock.release().catch(() => {});
      } catch {
        // e.g. battery saver on, or not allowed yet — try again on the next tap
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisible);
    document.addEventListener('pointerdown', acquire);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      document.removeEventListener('pointerdown', acquire);
      lock?.release().catch(() => {});
    };
  }, [active]);
}
