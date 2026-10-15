export type ToastKind = 'info' | 'checkpoint' | 'lap' | 'best' | 'warn' | 'camera';
export interface Toast { text: string; sub?: string; kind: ToastKind }
type Handler = (t: Toast) => void;
const handlers = new Set<Handler>();

/** Tiny event bus so game code can raise HUD toasts without touching React state. */
export const hudBus = {
  on(h: Handler): () => void { handlers.add(h); return () => { handlers.delete(h); }; },
  toast(t: Toast): void { handlers.forEach((h) => h(t)); },
};
