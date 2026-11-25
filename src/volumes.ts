/**
 * Per-player listening volume, like Discord's user volume slider.
 *
 * Stored on this device by nickname (case-insensitive), so a quiet friend stays
 * boosted at the next game night even though their player id is new.
 * 1 = 100%, range 0–2 (0–200%).
 */
const KEY = 'black_rada_volumes';

export type VolumeMap = Record<string, number>;

export const volumeKey = (nickname: string) => nickname.trim().toLowerCase();

export function loadVolumes(): VolumeMap {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as VolumeMap) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveVolumes(map: VolumeMap) {
  try {
    // Only remember non-default volumes to keep it small.
    const trimmed = Object.fromEntries(Object.entries(map).filter(([, v]) => v !== 1));
    window.localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    // storage disabled: volumes still work for this session
  }
}

export const clampVolume = (v: number) => Math.min(2, Math.max(0, Math.round(v * 100) / 100));
