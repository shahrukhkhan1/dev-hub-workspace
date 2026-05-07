import { useEffect, useState } from "react";
import { Volume2, VolumeX, HardDrive, Command } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sfx } from "@/lib/sfx";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function HeaderControls({ onOpenPalette }: { onOpenPalette: () => void }) {
  const [muted, setMuted] = useState(false);
  const [storage, setStorage] = useState<{ used: number; quota: number } | null>(null);

  useEffect(() => {
    setMuted(sfx.muted);
    const onChange = (e: Event) => setMuted((e as CustomEvent).detail);
    window.addEventListener("sfx:muted", onChange);
    return () => window.removeEventListener("sfx:muted", onChange);
  }, []);

  useEffect(() => {
    const tick = async () => {
      if (navigator.storage?.estimate) {
        const e = await navigator.storage.estimate();
        setStorage({ used: e.usage ?? 0, quota: e.quota ?? 0 });
      }
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, []);

  const fmt = (b: number) =>
    b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` :
    b < 1024 * 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` :
    `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;

  const pct = storage && storage.quota ? (storage.used / storage.quota) * 100 : 0;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1.5">
        {storage && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="hidden md:flex items-center gap-2 rounded-md border border-border/60 bg-glass px-2.5 py-1 text-[11px] text-muted-foreground">
                <HardDrive className="h-3.5 w-3.5" />
                <span>{fmt(storage.used)}</span>
                <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                Local storage: {fmt(storage.used)} of {fmt(storage.quota)}
                <div className="text-muted-foreground">{pct.toFixed(2)}% used</div>
              </div>
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost" size="sm" data-sfx
              onClick={onOpenPalette}
              className="h-8 gap-1.5 px-2 text-[11px] text-muted-foreground hover:text-foreground active:scale-95 transition-transform"
            >
              <Command className="h-3.5 w-3.5" />
              <kbd className="hidden sm:inline rounded bg-muted px-1 py-px text-[10px]">⌘K</kbd>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Command palette (⌘K / Ctrl+K)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost" size="icon"
              onClick={() => { const next = !muted; sfx.setMuted(next); if (!next) sfx.play("click"); }}
              className="h-8 w-8 active:scale-90 transition-transform"
              aria-label={muted ? "Unmute sounds" : "Mute sounds"}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{muted ? "Sound off" : "Sound on"}</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
