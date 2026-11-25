/**
 * Who can see and hear whom.
 *
 * One place for every media rule, so night secrecy and the Graveyard can't
 * drift apart between the video tiles, the audio layer and the server.
 *
 *  - Moderator: always seen and heard by everyone.
 *  - Graveyard (a game is in progress and the player is eliminated):
 *      dead players see and hear each other and spectate the living;
 *      living players never see or hear the dead;
 *      the Moderator sees the dead and hears them only when tuned in.
 *  - Night: a sleeping player sees and hears only the Moderator; awake players
 *      (e.g. the Mafia during their turn) see and hear each other.
 */
import { isPlayerAwakeDuringNight, type GamePhase, type NightStep } from './mafiaEngine';

export interface MediaPerson {
  id: string;
  isModerator: boolean;
  isAlive: boolean;
  role: string | null;
}

export interface MediaContext {
  phase: GamePhase;
  nightStep: NightStep;
  /** Moderator has tuned in to the Graveyard (local, per Moderator). */
  moderatorListeningToGraveyard: boolean;
}

export interface Perception {
  see: boolean;
  hear: boolean;
}

/** The Graveyard exists only while a game is running. */
export function isGraveyardActive(phase: GamePhase): boolean {
  return phase === 'NIGHT' || phase === 'DAY' || phase === 'VOTING';
}

export function isInGraveyard(p: MediaPerson, phase: GamePhase): boolean {
  return !p.isModerator && !p.isAlive && isGraveyardActive(phase);
}

/** Whether this person may use their mic/camera right now. */
export function isAwakeForMedia(p: MediaPerson, phase: GamePhase, nightStep: NightStep): boolean {
  if (p.isModerator) return true;
  if (isInGraveyard(p, phase)) return true; // the dead talk freely in their own room
  if (phase !== 'NIGHT') return true;
  return isPlayerAwakeDuringNight(p as Parameters<typeof isPlayerAwakeDuringNight>[0], nightStep);
}

/** What `viewer` perceives of `target` (ignores the target's own mute/camera toggles). */
export function perceive(viewer: MediaPerson | null, target: MediaPerson, ctx: MediaContext): Perception {
  if (!viewer) return { see: false, hear: false };
  if (viewer.id === target.id) return { see: true, hear: false }; // own preview, never echo

  const { phase, nightStep } = ctx;
  const targetDead = isInGraveyard(target, phase);
  const viewerDead = isInGraveyard(viewer, phase);

  if (targetDead) {
    if (viewerDead) return { see: true, hear: true };
    if (viewer.isModerator) return { see: true, hear: ctx.moderatorListeningToGraveyard };
    return { see: false, hear: false };
  }

  // Target is alive (or is the Moderator).
  if (target.isModerator) return { see: true, hear: true };
  if (viewer.isModerator) return { see: true, hear: true };

  const targetAwake = isAwakeForMedia(target, phase, nightStep);
  if (viewerDead) return { see: targetAwake, hear: targetAwake }; // spectators follow the action

  const viewerAwake = isAwakeForMedia(viewer, phase, nightStep);
  if (!viewerAwake) return { see: false, hear: false }; // eyes closed: only the Moderator
  return { see: targetAwake, hear: targetAwake };
}
