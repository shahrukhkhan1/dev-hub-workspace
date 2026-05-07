import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { sfx } from "@/lib/sfx";

export const Route = createFileRoute("/text")({
  head: () => ({
    meta: [
      { title: "Text & JSON Studio — DevSuite Hub" },
      { name: "description", content: "Beautify and minify JSON, view as a tree, count words/chars and convert text case — all client-side." },
    ],
  }),
  component: TextStudio,
});

const slugify = (s: string) =>
  s.toLowerCase().trim().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
const camel = (s: string) => s.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase());

function TreeNode({ k, v, depth = 0 }: { k?: string; v: any; depth?: number }) {
  const [open, setOpen] = useState(depth < 2);
  const isObj = v && typeof v === "object";
  if (!isObj) {
    return (
      <div className="font-mono text-xs leading-6">
        {k !== undefined && <span className="text-primary">"{k}"</span>}
        {k !== undefined && <span className="text-muted-foreground">: </span>}
        <span className={typeof v === "string" ? "text-success" : "text-warning"}>{JSON.stringify(v)}</span>
      </div>
    );
  }
  const arr = Array.isArray(v);
  const entries = arr ? v.map((vv, i) => [i, vv] as const) : Object.entries(v);
  return (
    <div className="font-mono text-xs leading-6">
      <button onClick={() => setOpen(!open)} className="hover:text-primary">
        {k !== undefined && <span className="text-primary">"{k}"</span>}
        {k !== undefined && <span className="text-muted-foreground">: </span>}
        <span className="text-muted-foreground">{open ? (arr ? "[" : "{") : `${arr ? "[…]" : "{…}"} (${entries.length})`}</span>
      </button>
      {open && (
        <div className="pl-4 border-l border-border/50 ml-1">
          {entries.map(([kk, vv]) => <TreeNode key={String(kk)} k={String(kk)} v={vv} depth={depth + 1} />)}
        </div>
      )}
      {open && <div className="text-muted-foreground">{arr ? "]" : "}"}</div>}
    </div>
  );
}

function TextStudio() {
  const [input, setInput] = useState('{\n  "name": "DevSuite",\n  "tools": ["json", "qr", "css"],\n  "premium": true\n}');

  const json = useMemo(() => { try { return { ok: true as const, data: JSON.parse(input) }; } catch (e: any) { return { ok: false as const, err: e.message }; } }, [input]);
  const stats = useMemo(() => ({
    chars: input.length,
    words: input.trim() ? input.trim().split(/\s+/).length : 0,
    lines: input ? input.split("\n").length : 0,
  }), [input]);

  const copy = (s: string) => { navigator.clipboard.writeText(s); sfx.play("success"); toast.success("Copied"); };
  const set = (s: string) => setInput(s);

  return (
    <div className="container mx-auto max-w-7xl p-4 md:p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Text & JSON Studio</h2>
        <p className="text-sm text-muted-foreground">Beautify, minify or transform any text. Auto-detects JSON.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="glass-panel p-4 space-y-3">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Input</span>
            <span>{stats.chars} chars · {stats.words} words · {stats.lines} lines</span>
          </div>
          <Textarea value={input} onChange={(e) => setInput(e.target.value)} className="min-h-[420px] font-mono text-xs" spellCheck={false} />
          <div className="flex flex-wrap gap-2">
            {json.ok ? <>
              <Button data-sfx size="sm" onClick={() => set(JSON.stringify(json.data, null, 2))} className="active:scale-95 transition-transform">Beautify JSON</Button>
              <Button data-sfx size="sm" variant="secondary" onClick={() => set(JSON.stringify(json.data))} className="active:scale-95 transition-transform">Minify JSON</Button>
            </> : <span className="text-xs text-destructive self-center">JSON: {json.err}</span>}
            <Button data-sfx size="sm" variant="outline" onClick={() => set(input.toUpperCase())} className="active:scale-95 transition-transform">UPPER</Button>
            <Button data-sfx size="sm" variant="outline" onClick={() => set(input.toLowerCase())} className="active:scale-95 transition-transform">lower</Button>
            <Button data-sfx size="sm" variant="outline" onClick={() => set(camel(input))} className="active:scale-95 transition-transform">camelCase</Button>
            <Button data-sfx size="sm" variant="outline" onClick={() => set(slugify(input))} className="active:scale-95 transition-transform">slugify</Button>
            <Button data-sfx size="sm" variant="ghost" onClick={() => copy(input)} className="ml-auto active:scale-95 transition-transform"><Copy className="h-3.5 w-3.5 mr-1" /> Copy</Button>
          </div>
        </Card>

        <Card className="glass-panel p-4">
          <Tabs defaultValue="tree">
            <TabsList>
              <TabsTrigger value="tree">Tree view</TabsTrigger>
              <TabsTrigger value="raw">Raw output</TabsTrigger>
            </TabsList>
            <TabsContent value="tree" className="mt-3 max-h-[460px] overflow-auto">
              {json.ok ? <TreeNode v={json.data} /> : <p className="text-xs text-muted-foreground">Paste valid JSON to view as a tree.</p>}
            </TabsContent>
            <TabsContent value="raw" className="mt-3">
              <pre className="text-xs font-mono whitespace-pre-wrap break-all max-h-[460px] overflow-auto">{json.ok ? JSON.stringify(json.data, null, 2) : input}</pre>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
