import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Upload, Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/pdf")({
  head: () => ({
    meta: [
      { title: "PDF Compressor — DevSuite Hub" },
      { name: "description", content: "Web-optimized PDF compression that runs entirely in your browser using pdf-lib." },
    ],
  }),
  component: PdfCompressor,
});

const fmt = (b: number) => b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b/1024).toFixed(1)} KB` : `${(b/1024/1024).toFixed(2)} MB`;

interface Result { name: string; original: number; compressed: number; url: string; }

function PdfCompressor() {
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const [stripMeta, setStripMeta] = useState(true);
  const [webOptimize, setWebOptimize] = useState(true);

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    setBusy(true);
    const out: Result[] = [];
    for (const f of Array.from(files)) {
      try {
        if (f.type && f.type !== "application/pdf") {
          toast.error(`${f.name} is not a PDF`);
          continue;
        }
        const buf = await f.arrayBuffer();
        let pdf;
        try {
          pdf = await PDFDocument.load(buf, { updateMetadata: false });
        } catch (loadErr) {
          const msg = String((loadErr as Error)?.message || loadErr).toLowerCase();
          if (msg.includes("encrypt") || msg.includes("password")) {
            toast.error(`${f.name} is password-protected`, {
              description: "Remove the password in your PDF reader, then try again.",
            });
          } else {
            toast.error(`${f.name} could not be read`, {
              description: "The file appears to be corrupted or not a valid PDF.",
            });
          }
          continue;
        }
        if (stripMeta) {
          pdf.setTitle(""); pdf.setAuthor(""); pdf.setSubject("");
          pdf.setKeywords([]); pdf.setProducer(""); pdf.setCreator("");
        }
        const bytes = await pdf.save({ useObjectStreams: webOptimize, addDefaultPage: false });
        const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
        // pdf-lib can't downsample embedded images further; if the rewrite
        // produced no meaningful saving, tell the user clearly instead of
        // shipping a "0% smaller" result that looks like a bug.
        if (blob.size >= f.size * 0.99) {
          toast.info(`${f.name} is already highly optimized`, {
            description: "No further size reduction was possible client-side.",
          });
          continue;
        }
        out.push({
          name: f.name.replace(/\.pdf$/i, "") + ".min.pdf",
          original: f.size, compressed: blob.size, url: URL.createObjectURL(blob),
        });
      } catch (e) {
        console.error(e);
        toast.error(`Failed: ${f.name}`, { description: "Unexpected error during compression." });
      }
    }
    setResults(prev => [...out, ...prev]);
    setBusy(false);
    if (out.length) toast.success(`Compressed ${out.length} file(s)`);
  };

  return (
    <div className="container mx-auto max-w-5xl p-4 md:p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">PDF Compressor</h2>
        <p className="text-sm text-muted-foreground">Strip metadata and rewrite PDFs for fast web viewing.</p>
      </div>

      <Card className="glass-panel p-5 grid sm:grid-cols-2 gap-4">
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div>
            <div className="text-sm font-medium">Strip metadata</div>
            <div className="text-xs text-muted-foreground">Remove title, author, producer info</div>
          </div>
          <Switch checked={stripMeta} onCheckedChange={setStripMeta} />
        </label>
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div>
            <div className="text-sm font-medium">Web-optimized output</div>
            <div className="text-xs text-muted-foreground">Use object streams (smaller)</div>
          </div>
          <Switch checked={webOptimize} onCheckedChange={setWebOptimize} />
        </label>
      </Card>

      <Card
        className="glass-panel border-dashed border-2 border-border/60 hover:border-primary/50 p-10 text-center cursor-pointer transition-colors"
        onClick={() => document.getElementById("pdfin")?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
      >
        {busy ? <Loader2 className="h-10 w-10 mx-auto mb-3 animate-spin" /> : <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />}
        <p className="font-medium">Drop PDF files or click to select</p>
        <p className="text-xs text-muted-foreground mt-1">Files never leave your device</p>
        <input id="pdfin" type="file" accept="application/pdf" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      </Card>

      {results.length > 0 && (
        <Card className="glass-panel divide-y divide-border/50">
          {results.map((r, i) => {
            const saved = Math.round((1 - r.compressed / r.original) * 100);
            return (
              <div key={i} className="flex items-center gap-3 p-4">
                <FileText className="h-8 w-8 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{fmt(r.original)} → <span className="text-success">{fmt(r.compressed)}</span> · {saved > 0 ? `${saved}% smaller` : "no reduction"}</div>
                </div>
                <Button size="sm" asChild><a href={r.url} download={r.name}><Download className="h-4 w-4 mr-1" /> Save</a></Button>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
