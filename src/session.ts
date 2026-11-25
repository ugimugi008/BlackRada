/**
 * Remembers this device's seat so a reload, a closed tab or a dead battery
 * puts the player (or Moderator) straight back into the same seat.
 *
 * Only the room code, player id and the secret seat tokens are stored, in
 * this browser's localStorage. Sessions expire after 12 hours.
 */
export interface SeatSession {
  code: string;
  playerId: string;
  playerToken: string;
  moderatorToken: string | null;
  micMuted: boolean;
  camOff: boolean;
  savedAt: number;
}

const KEY = 'black_rada_seat';
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function loadSeatSession(): SeatSession | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SeatSession;
    if (!s?.code || !s.playerId || !s.playerToken) return null;
    if (Date.now() - (s.savedAt || 0) > MAX_AGE_MS) {
      clearSeatSession();
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function saveSeatSession(next: Omit<SeatSession, 'savedAt'>) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...next, savedAt: Date.now() }));
  } catch {
    // Private mode / storage disabled: reconnect still works within this tab.
  }
}

export function updateSeatSession(patch: Partial<Omit<SeatSession, 'savedAt'>>) {
  const current = loadSeatSession();
  if (!current) return;
  saveSeatSession({ ...current, ...patch });
}

export function clearSeatSession() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
