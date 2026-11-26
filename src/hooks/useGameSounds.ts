import { useEffect, useRef } from 'react';
import type { RoomPublicState } from '../shared/mafiaEngine';
import { playMorning, playNight, playTick } from '../audio/cues';

/** Seconds at the end of a timed speech that get a clock tick. */
export const TICK_FROM = 5;

/**
 * Plays the game's sound cues from room state changes:
 *  - night falls (any phase -> NIGHT): a low, quiet tone
 *  - the town wakes up (NIGHT -> DAY): a short morning chime
 *  - last 5 seconds of a "На розмову" speech or last words: one tick per second
 * Nothing plays when you first open or rejoin a room mid-game.
 */
export function useGameSounds(room: RoomPublicState | null): void {
  const prevPhase = useRef<string | null>(null);
  const prevRoom = useRef<string | null>(null);
  const prevSeconds = useRef<{ key: string; seconds: number } | null>(null);

  const phase = room?.phase ?? null;
  const code = room?.code ?? null;
  useEffect(() => {
    const sameRoom = prevRoom.current === code;
    const before = prevPhase.current;
    prevRoom.current = code;
    prevPhase.current = phase;
    if (!sameRoom || !before || before === phase) return;
    if (phase === 'NIGHT') playNight();
    else if (phase === 'DAY' && before === 'NIGHT') playMorning();
  }, [phase, code]);

  const speech = room?.talk ?? room?.lastWords ?? null;
  const key = speech ? `${room?.talk ? 'talk' : 'last'}:${speech.playerId}` : '';
  const seconds = speech?.secondsLeft ?? -1;
  useEffect(() => {
    const prev = prevSeconds.current;
    prevSeconds.current = key ? { key, seconds } : null;
    // tick only while the same speech counts down (not on start, +30 s or pause)
    if (!prev || prev.key !== key) return;
    if (seconds < prev.seconds && seconds >= 1 && seconds <= TICK_FROM) playTick();
  }, [key, seconds]);
}
