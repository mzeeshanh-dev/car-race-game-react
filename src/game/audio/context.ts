let context: AudioContext | null = null;
export function currentAudioContext() { return context; }
/** Called during a user gesture, before asynchronous scene loading. */
export function unlockAudio() {
  try {
    context ??= new AudioContext();
    void context.resume().catch(() => {});
  } catch { context = null; }
  return context;
}
export function releaseAudio(ctx: AudioContext) {
  if (context === ctx) context = null;
  void ctx.close().catch(() => {});
}
