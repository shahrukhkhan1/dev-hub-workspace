import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { Image, FileText, Code2, ShieldCheck, Type, KeyRound, QrCode, Palette, Trash2, Volume2, LayoutGrid, FileCode2 } from "lucide-react";
import { db } from "@/lib/db";
import { sfx } from "@/lib/sfx";
import { toast } from "sonner";

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const go = (path: string) => { onOpenChange(false); navigate({ to: path }); };

  const tools = [
    { i: LayoutGrid, n: "Dashboard", p: "/" },
    { i: Image, n: "Image Studio", p: "/image" },
    { i: FileText, n: "PDF Compressor", p: "/pdf" },
    { i: Code2, n: "Code Playground", p: "/code" },
    { i: ShieldCheck, n: "Accessibility Auditor", p: "/a11y" },
    { i: Type, n: "Text & JSON Studio", p: "/text" },
    { i: KeyRound, n: "Password & UUID Generator", p: "/password" },
    { i: QrCode, n: "QR Code Studio", p: "/qr" },
    { i: Palette, n: "CSS Design Helper", p: "/css" },
    { i: FileCode2, n: "Word to HTML", p: "/word-to-html" },
  ];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search tools, run actions..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Tools">
          {tools.map((t) => (
            <CommandItem key={t.p} onSelect={() => go(t.p)}>
              <t.i className="h-4 w-4" /> <span>{t.n}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => { sfx.setMuted(!sfx.muted); onOpenChange(false); }}>
            <Volume2 className="h-4 w-4" /> <span>Toggle sound</span>
          </CommandItem>
          <CommandItem onSelect={async () => {
            if (!confirm("Clear all saved projects from local storage?")) return;
            await db.projects.clear();
            toast.success("Workspace cleared");
            onOpenChange(false);
          }}>
            <Trash2 className="h-4 w-4" /> <span>Clear workspace (local data)</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
