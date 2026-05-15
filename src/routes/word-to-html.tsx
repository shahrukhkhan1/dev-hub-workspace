import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import mammoth from "mammoth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, Upload, ClipboardPaste, Download, Eraser } from "lucide-react";
import { sfx } from "@/lib/sfx";

export const Route = createFileRoute("/word-to-html")({
  head: () => ({
    meta: [
      { title: "Word to HTML — DevSuite Hub" },
      { name: "description", content: "Convert Word documents or pasted rich text to clean, semantic HTML — paragraphs, lists, links and bold preserved. 100% client-side." },
    ],
  }),
  component: WordToHtml,
});

/** Clean Word/Google Docs HTML → semantic, blog-ready markup. */
function cleanHtml(raw: string, opts: { useB: boolean; linksBlank: boolean; bulletPrefix: boolean }) {
  if (!raw) return "";
  // Strip Word conditional comments and meta cruft
  let html = raw
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<\/?(o:|w:|m:|v:)[a-z]+[^>]*>/gi, "")
    .replace(/<meta[^>]*>/gi, "")
    .replace(/<link[^>]*>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "");

  const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, "text/html");
  const root = doc.getElementById("r")!;

  // Unwrap spans/divs, drop class/style/id/lang/dir on everything
  root.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((a) => {
      if (a.name === "href" || a.name === "src" || a.name === "alt") return;
      el.removeAttribute(a.name);
    });
  });

  // Normalize tags
  root.querySelectorAll("strong").forEach((el) => {
    const tag = opts.useB ? "b" : "strong";
    if (el.tagName.toLowerCase() === tag) return;
    const n = doc.createElement(tag); n.innerHTML = el.innerHTML; el.replaceWith(n);
  });
  root.querySelectorAll("b").forEach((el) => {
    if (opts.useB) return;
    const n = doc.createElement("strong"); n.innerHTML = el.innerHTML; el.replaceWith(n);
  });
  root.querySelectorAll("i").forEach((el) => {
    const n = doc.createElement("em"); n.innerHTML = el.innerHTML; el.replaceWith(n);
  });

  // Links: external → target="_blank" rel
  if (opts.linksBlank) {
    root.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href") || "";
      if (/^https?:\/\//i.test(href)) {
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
      }
    });
  }

  // Unwrap divs/sections to paragraphs
  root.querySelectorAll("div, section, article").forEach((el) => {
    const p = doc.createElement("p");
    p.innerHTML = el.innerHTML;
    el.replaceWith(p);
  });

  // Bullet prefix inside <li> (matches user's preferred style)
  if (opts.bulletPrefix) {
    root.querySelectorAll("ul > li").forEach((li) => {
      const t = li.textContent?.trimStart() ?? "";
      if (!t.startsWith("•")) li.innerHTML = "• " + li.innerHTML;
    });
  }

  // Pretty-print: each block element on its own line with a blank line between
  const blocks = ["p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "blockquote", "pre", "table"];
  let out = "";
  root.childNodes.forEach((node) => {
    if (node.nodeType === 1) {
      const el = node as Element;
      const tag = el.tagName.toLowerCase();
      if (blocks.includes(tag)) {
        if (tag === "ul" || tag === "ol") {
          out += `<${tag}>\n`;
          el.querySelectorAll(":scope > li").forEach((li) => {
            out += `\n<li>${li.innerHTML.trim()}</li>\n`;
          });
          out += `\n</${tag}>\n\n`;
        } else {
          out += el.outerHTML + "\n\n";
        }
      } else {
        out += el.outerHTML + "\n\n";
      }
    } else if (node.nodeType === 3) {
      const t = node.textContent?.trim();
      if (t) out += `<p>${t}</p>\n\n`;
    }
  });

  return out
    .replace(/\n{3,}/g, "\n\n")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function WordToHtml() {
  const [raw, setRaw] = useState<string>("");
  const [useB, setUseB] = useState(true);
  const [linksBlank, setLinksBlank] = useState(true);
  const [bulletPrefix, setBulletPrefix] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const output = useMemo(
    () => cleanHtml(raw, { useB, linksBlank, bulletPrefix }),
    [raw, useB, linksBlank, bulletPrefix],
  );

  const onFile = async (f: File) => {
    if (!f) return;
    if (!/\.docx?$/i.test(f.name)) {
      toast.error("Please upload a .docx file");
      sfx.play("error");
      return;
    }
    try {
      const buf = await f.arrayBuffer();
      const { value, messages } = await mammoth.convertToHtml({ arrayBuffer: buf });
      setRaw(value);
      sfx.play("success");
      toast.success(`Imported ${f.name}`, { description: messages.length ? `${messages.length} note(s)` : undefined });
    } catch (e: any) {
      sfx.play("error");
      toast.error("Failed to parse document", { description: e.message });
    }
  };

  const onPaste = async () => {
    try {
      const items = await (navigator.clipboard as any).read?.();
      if (items) {
        for (const it of items) {
          if (it.types.includes("text/html")) {
            const blob = await it.getType("text/html");
            setRaw(await blob.text());
            sfx.play("success"); toast.success("Pasted rich text");
            return;
          }
        }
      }
      const t = await navigator.clipboard.readText();
      setRaw(t);
      toast.success("Pasted plain text");
    } catch {
      toast.error("Clipboard read blocked — paste into the editor below instead");
    }
  };

  const copy = () => { navigator.clipboard.writeText(output); sfx.play("success"); toast.success("HTML copied"); };
  const download = () => {
    const blob = new Blob([output], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "converted.html"; a.click();
    URL.revokeObjectURL(url);
  };

  const onEditorPaste = (e: React.ClipboardEvent) => {
    const html = e.clipboardData.getData("text/html");
    if (html) {
      e.preventDefault();
      setRaw(html);
      if (editorRef.current) editorRef.current.innerHTML = html;
      sfx.play("success");
    }
  };

  return (
    <div className="container mx-auto max-w-7xl p-4 md:p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Word to HTML</h2>
        <p className="text-sm text-muted-foreground">
          Upload a .docx file or paste from Word / Google Docs. Get clean, blog-ready HTML — bold, links, and lists preserved.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="glass-panel p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button data-sfx size="sm" onClick={() => fileRef.current?.click()} className="active:scale-95 transition-transform">
              <Upload className="h-4 w-4 mr-1.5" /> Upload .docx
            </Button>
            <input ref={fileRef} type="file" accept=".docx,.doc" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            <Button data-sfx size="sm" variant="secondary" onClick={onPaste} className="active:scale-95 transition-transform">
              <ClipboardPaste className="h-4 w-4 mr-1.5" /> Paste from clipboard
            </Button>
            <Button data-sfx size="sm" variant="ghost" onClick={() => { setRaw(""); if (editorRef.current) editorRef.current.innerHTML = ""; }} className="ml-auto active:scale-95 transition-transform">
              <Eraser className="h-4 w-4 mr-1.5" /> Clear
            </Button>
          </div>

          <Tabs defaultValue="rich">
            <TabsList>
              <TabsTrigger value="rich">Rich paste area</TabsTrigger>
              <TabsTrigger value="raw">Raw HTML input</TabsTrigger>
            </TabsList>
            <TabsContent value="rich" className="mt-3">
              <div
                ref={editorRef}
                contentEditable
                onPaste={onEditorPaste}
                onInput={(e) => setRaw((e.currentTarget as HTMLDivElement).innerHTML)}
                className="min-h-[420px] max-h-[520px] overflow-auto rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring prose prose-invert max-w-none [&_a]:text-primary [&_a]:underline"
                suppressContentEditableWarning
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">Paste from Word / Google Docs (Ctrl/⌘+V). Formatting is preserved.</p>
            </TabsContent>
            <TabsContent value="raw" className="mt-3">
              <Textarea value={raw} onChange={(e) => setRaw(e.target.value)} className="min-h-[420px] font-mono text-xs" spellCheck={false} placeholder="<p>Paste any HTML or Word markup here...</p>" />
            </TabsContent>
          </Tabs>

          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/50">
            <div className="flex items-center gap-2">
              <Switch id="useB" checked={useB} onCheckedChange={setUseB} />
              <Label htmlFor="useB" className="text-xs cursor-pointer">Use &lt;b&gt; (not &lt;strong&gt;)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="linksBlank" checked={linksBlank} onCheckedChange={setLinksBlank} />
              <Label htmlFor="linksBlank" className="text-xs cursor-pointer">Links open in new tab</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="bulletPrefix" checked={bulletPrefix} onCheckedChange={setBulletPrefix} />
              <Label htmlFor="bulletPrefix" className="text-xs cursor-pointer">• prefix in list items</Label>
            </div>
          </div>
        </Card>

        <Card className="glass-panel p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{output.length.toLocaleString()} chars</span>
            <div className="flex gap-2">
              <Button data-sfx size="sm" variant="secondary" onClick={download} disabled={!output} className="active:scale-95 transition-transform">
                <Download className="h-4 w-4 mr-1.5" /> .html
              </Button>
              <Button data-sfx size="sm" onClick={copy} disabled={!output} className="active:scale-95 transition-transform">
                <Copy className="h-4 w-4 mr-1.5" /> Copy HTML
              </Button>
            </div>
          </div>
          <Tabs defaultValue="code">
            <TabsList>
              <TabsTrigger value="code">HTML code</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
            <TabsContent value="code" className="mt-3">
              <pre className="text-xs font-mono whitespace-pre-wrap break-words max-h-[520px] overflow-auto rounded-md bg-muted/30 p-3">{output || <span className="text-muted-foreground">Output will appear here…</span>}</pre>
            </TabsContent>
            <TabsContent value="preview" className="mt-3">
              <div
                className="prose prose-invert max-w-none max-h-[520px] overflow-auto rounded-md bg-muted/20 p-4 text-sm [&_a]:text-primary [&_a]:underline [&_p]:my-2 [&_ul]:my-2 [&_li]:my-1"
                dangerouslySetInnerHTML={{ __html: output }}
              />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
