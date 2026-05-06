import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import axe from "axe-core";
import { ShieldCheck, AlertTriangle, AlertCircle, Info, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/a11y")({
  head: () => ({
    meta: [
      { title: "Accessibility Auditor — DevSuite Hub" },
      { name: "description", content: "Run axe-core WCAG 2.1 accessibility checks on raw HTML, with copy-paste fix suggestions." },
    ],
  }),
  component: A11y,
});

interface Violation {
  id: string;
  impact: string;
  help: string;
  helpUrl: string;
  description: string;
  nodes: { html: string; failureSummary: string; target: string[] }[];
}

const SAMPLE = `<html>\n<body>\n  <img src="logo.png">\n  <a href="#"><i class="fa fa-cart"></i></a>\n  <input type="text" placeholder="Email">\n  <div onclick="submit()">Submit</div>\n  <p style="color:#aaa;background:#fff">Low contrast text</p>\n</body>\n</html>`;

const FIXES: Record<string, (html: string) => string> = {
  "image-alt": () => `<!-- Add descriptive alt text -->\n<img src="logo.png" alt="Company logo">`,
  "label": () => `<!-- Associate label with input -->\n<label for="email">Email</label>\n<input id="email" type="email" name="email">`,
  "link-name": () => `<!-- Provide accessible name -->\n<a href="/cart" aria-label="View shopping cart">\n  <i class="fa fa-cart" aria-hidden="true"></i>\n</a>`,
  "color-contrast": () => `<!-- Use 4.5:1 contrast ratio minimum -->\n<p style="color:#333;background:#fff">Readable text</p>`,
  "button-name": () => `<!-- Use a real button with accessible name -->\n<button type="submit">Submit</button>`,
  "html-has-lang": () => `<html lang="en">`,
  "document-title": () => `<title>Page Title</title>`,
};

const impactRank = { critical: 4, serious: 3, moderate: 2, minor: 1 } as const;
const impactColor: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  serious: "bg-destructive/10 text-destructive border-destructive/20",
  moderate: "bg-warning/15 text-warning border-warning/30",
  minor: "bg-muted text-muted-foreground border-border",
};
const impactIcon: Record<string, typeof AlertTriangle> = {
  critical: AlertCircle, serious: AlertTriangle, moderate: AlertTriangle, minor: Info,
};

function A11y() {
  const [html, setHtml] = useState(SAMPLE);
  const [violations, setViolations] = useState<Violation[] | null>(null);
  const [running, setRunning] = useState(false);
  const [passes, setPasses] = useState(0);

  const audit = async () => {
    setRunning(true);
    const sandbox = document.createElement("iframe");
    sandbox.style.position = "fixed";
    sandbox.style.left = "-99999px";
    sandbox.style.width = "1024px";
    sandbox.style.height = "768px";
    document.body.appendChild(sandbox);
    try {
      const doc = sandbox.contentDocument!;
      doc.open(); doc.write(html); doc.close();
      await new Promise(r => setTimeout(r, 200));
      const results = await axe.run(doc, { resultTypes: ["violations", "passes"] });
      const sorted = [...results.violations].sort(
        (a, b) => (impactRank[(b.impact ?? "minor") as keyof typeof impactRank] ?? 0) -
                  (impactRank[(a.impact ?? "minor") as keyof typeof impactRank] ?? 0)
      ) as Violation[];
      setViolations(sorted);
      setPasses(results.passes.length);
    } catch (e) { console.error(e); toast.error("Audit failed"); }
    finally { document.body.removeChild(sandbox); setRunning(false); }
  };

  const copyFix = (id: string) => {
    const fix = FIXES[id]?.("") ?? `<!-- Review ${id} guidance and apply suggested ARIA / semantic improvements -->`;
    navigator.clipboard.writeText(fix);
    toast.success("Fix copied");
  };

  const counts = violations?.reduce((acc, v) => {
    const k = (v.impact ?? "minor") as keyof typeof impactRank;
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>) ?? {};

  return (
    <div className="container mx-auto max-w-7xl p-4 md:p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Accessibility Auditor</h2>
        <p className="text-sm text-muted-foreground">Paste raw HTML to get instant WCAG 2.1 violations with copy-paste fixes — powered by axe-core.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="glass-panel p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">HTML input</span>
            <Button size="sm" variant="ghost" onClick={() => setHtml(SAMPLE)}>Load sample</Button>
          </div>
          <Textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            className="font-mono text-xs h-[400px] resize-none"
          />
          <Button onClick={audit} disabled={running} className="w-full">
            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
            Run audit
          </Button>
        </Card>

        <div className="space-y-4">
          {violations === null ? (
            <Card className="glass-panel p-10 text-center text-muted-foreground">
              <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-40" />
              Run the audit to see violations and fixes
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2">
                {(["critical","serious","moderate","minor"] as const).map(k => (
                  <Card key={k} className={`p-3 text-center border ${impactColor[k]}`}>
                    <div className="text-2xl font-bold">{counts[k] ?? 0}</div>
                    <div className="text-[10px] uppercase tracking-wider">{k}</div>
                  </Card>
                ))}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <Badge variant="outline" className="bg-success/10 text-success border-success/30">{passes} checks passed</Badge>
                <Badge variant="outline">{violations.length} violations</Badge>
              </div>

              {violations.length === 0 ? (
                <Card className="glass-panel p-8 text-center">
                  <ShieldCheck className="h-10 w-10 mx-auto mb-3 text-success" />
                  <p className="font-semibold">No violations found</p>
                  <p className="text-xs text-muted-foreground">Great job — your markup passes axe-core.</p>
                </Card>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-auto pr-2">
                  {violations.map(v => {
                    const Icon = impactIcon[v.impact ?? "minor"];
                    return (
                      <Card key={v.id} className="glass-panel p-4 space-y-2">
                        <div className="flex items-start gap-2">
                          <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{v.help}</span>
                              <Badge className={`${impactColor[v.impact ?? "minor"]} text-[10px]`} variant="outline">{v.impact}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{v.description}</p>
                          </div>
                        </div>
                        {v.nodes.slice(0, 2).map((n, i) => (
                          <pre key={i} className="text-[11px] bg-muted/40 rounded p-2 overflow-auto font-mono">{n.html}</pre>
                        ))}
                        <div className="flex items-center gap-2 pt-1">
                          <Button size="sm" variant="secondary" onClick={() => copyFix(v.id)}>
                            <Copy className="h-3 w-3 mr-1" /> Copy suggested fix
                          </Button>
                          <a href={v.helpUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Learn more →</a>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
