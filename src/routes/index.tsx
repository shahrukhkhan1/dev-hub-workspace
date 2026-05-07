import { createFileRoute, Link } from "@tanstack/react-router";
import { Image as ImageIcon, FileText, Code2, ShieldCheck, Type, KeyRound, QrCode, Palette, ArrowUpRight, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DevSuite Hub — All-in-one Developer & Creator Toolkit" },
      { name: "description", content: "A premium client-side workspace: image & PDF compression, code playground, accessibility auditing, and daily quick utilities." },
    ],
  }),
  component: Dashboard,
});

type Tool = { name: string; desc: string; to: string; icon: any; tags: string[]; gradient: string };

const categories: { label: string; tools: Tool[] }[] = [
  {
    label: "Media Optimization",
    tools: [
      { name: "Image Studio", desc: "Bulk compress, resize and convert images to WebP, JPEG, PNG.", to: "/image", icon: ImageIcon, tags: ["Offline Ready", "Web Fast"], gradient: "from-cyan-400 to-blue-500" },
      { name: "PDF Compressor", desc: "Shrink PDFs and strip metadata — entirely in your browser.", to: "/pdf", icon: FileText, tags: ["Offline Ready", "Secure"], gradient: "from-rose-400 to-orange-500" },
    ],
  },
  {
    label: "Developer Environments",
    tools: [
      { name: "Code Playground", desc: "Run HTML/JS, React and Python with live preview & sharing.", to: "/code", icon: Code2, tags: ["Web Fast", "Sandboxed"], gradient: "from-violet-400 to-fuchsia-500" },
    ],
  },
  {
    label: "Quality Assurance",
    tools: [
      { name: "Accessibility Auditor", desc: "Audit any HTML against WCAG with axe-core and fix snippets.", to: "/a11y", icon: ShieldCheck, tags: ["Offline Ready", "WCAG"], gradient: "from-emerald-400 to-teal-500" },
    ],
  },
  {
    label: "Daily Quick Tools",
    tools: [
      { name: "Text & JSON Studio", desc: "Beautify / minify JSON, tree view, case converters & counters.", to: "/text", icon: Type, tags: ["Instant", "Offline"], gradient: "from-amber-400 to-yellow-500" },
      { name: "Password & UUID", desc: "Generate secure passwords, UUIDv4 and crypto hashes.", to: "/password", icon: KeyRound, tags: ["Secure", "Crypto"], gradient: "from-pink-400 to-rose-500" },
      { name: "QR Code Studio", desc: "Custom-colored QR codes — export PNG or SVG.", to: "/qr", icon: QrCode, tags: ["Web Fast"], gradient: "from-sky-400 to-indigo-500" },
      { name: "CSS Design Helper", desc: "Visual gradient, shadow & glassmorphism code generator.", to: "/css", icon: Palette, tags: ["Designer"], gradient: "from-lime-400 to-green-500" },
    ],
  },
];

function Dashboard() {
  return (
    <div className="container mx-auto max-w-7xl p-4 md:p-8 space-y-10 animate-in fade-in duration-500">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-glass px-3 py-1 text-[11px] text-muted-foreground">
          <Sparkles className="h-3 w-3 text-primary" /> Premium client-side workspace
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Your daily <span className="text-gradient">creator & developer</span> toolkit
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Every tool runs locally in your browser. No uploads, no accounts, no waiting. Press{" "}
          <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px]">⌘ K</kbd> to jump anywhere.
        </p>
      </header>

      {categories.map((cat) => (
        <section key={cat.label} className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{cat.label}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cat.tools.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                data-sfx
                className="group relative block focus-visible:outline-none"
              >
                <Card className="glass-panel relative overflow-hidden p-5 h-full transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-glow group-active:scale-[0.98] border-border/60 group-hover:border-primary/40">
                  {/* glow halo */}
                  <div className="pointer-events-none absolute -inset-px rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: "radial-gradient(400px circle at var(--x,50%) var(--y,50%), oklch(0.72 0.18 200 / 0.15), transparent 40%)" }} />
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${t.gradient} shadow-card`}>
                      <t.icon className="h-5 w-5 text-white" />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                  <h3 className="text-base font-semibold tracking-tight">{t.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{t.desc}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {t.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px] font-medium px-2 py-0">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
