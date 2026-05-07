// Lightweight WebAudio click engine — no asset downloads.
let ctx: AudioContext | null = null;
const STORAGE_KEY = "devsuite:muted";

export const sfx = {
  get muted() {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "1";
  },
  setMuted(v: boolean) {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    window.dispatchEvent(new CustomEvent("sfx:muted", { detail: v }));
  },
  play(kind: "click" | "success" | "error" = "click") {
    if (typeof window === "undefined" || this.muted) return;
    try {
      ctx ||= new (window.AudioContext || (window as any).webkitAudioContext)();
      const c = ctx;
      const now = c.currentTime;
      const o = c.createOscillator();
      const g = c.createGain();
      o.connect(g); g.connect(c.destination);
      const map = {
        click:   { f: 880,  d: 0.04, type: "triangle" as const, vol: 0.06 },
        success: { f: 660,  d: 0.12, type: "sine" as const,     vol: 0.09 },
        error:   { f: 220,  d: 0.18, type: "square" as const,   vol: 0.07 },
      }[kind];
      o.type = map.type;
      o.frequency.setValueAtTime(map.f, now);
      if (kind === "success") o.frequency.exponentialRampToValueAtTime(map.f * 1.5, now + map.d);
      g.gain.setValueAtTime(map.vol, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + map.d);
      o.start(now); o.stop(now + map.d + 0.02);
    } catch {}
  },
};

// Auto-attach to all clicks on elements with [data-sfx]
if (typeof window !== "undefined") {
  window.addEventListener("click", (e) => {
    const t = e.target as HTMLElement | null;
    if (t?.closest("[data-sfx]")) sfx.play("click");
  }, { capture: true });
}
