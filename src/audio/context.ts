// One AudioContext for the whole app (remote voices above 100%, sound cues).
// Browsers start it suspended until the user interacts, so resume on the first tap/key.
let sharedContext: AudioContext | null = null;

export function audioContext(): AudioContext | null {
  if (sharedContext) return sharedContext;
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  sharedContext = new Ctor();
  const resume = () => {
    sharedContext?.resume().catch(() => {});
  };
  document.addEventListener('pointerdown', resume);
  document.addEventListener('keydown', resume);
  return sharedContext;
}
