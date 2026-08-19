import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Upload, Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/pdf")({
  head: () => ({
    meta: [
      { title: "PDF Compressor — DevSuite Hub" },
      { name: "description", content: "Real client-side PDF compression: downsample pages, strip metadata and rewrite for fast web viewing." },
      { property: "og:title", content: "PDF Compressor — DevSuite Hub" },
      { property: "og:description", content: "Shrink PDFs in your browser — nothing is uploaded." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PdfCompressor,
});

const fmt = (b: number) => b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b/1024).toFixed(1)} KB` : `${(b/1024/1024).toFixed(2)} MB`;

interface Result { name: string; original: number; compressed: number; url: string; mode: string; }

type Level = "lossless" | "light" | "balanced" | "strong" | "extreme";

const LEVELS: Record<Exclude<Level, "lossless">, { scale: number; quality: number; label: string }> = {
  light: { scale: 1.5, quality: 0.82, label: "Light" },
  balanced: { scale: 1.2, quality: 0.65, label: "Balanced" },
  strong: { scale: 1.0, quality: 0.5, label: "Strong" },
  extreme: { scale: 0.8, quality: 0.35, label: "Extreme" },
};

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const lib = await import("pdfjs-dist");
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default as string;
      lib.GlobalWorkerOptions.workerSrc = workerUrl;
      return lib;
    })();
  }
  return pdfjsPromise;
}

async function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Uint8Array> {
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", quality),
  );
  return new Uint8Array(await blob.arrayBuffer());
}

/** Rasterizes every page at a reduced scale and re-embeds as JPEG — this is
 *  what actually shrinks image-heavy PDFs (pdf-lib alone cannot downsample). */
async function rasterCompress(
  buf: ArrayBuffer,
  level: Exclude<Level, "lossless">,
  grayscale: boolean,
  onPage: (page: number, total: number) => void,
) {
  const { scale, quality } = LEVELS[level];
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
  const out = await PDFDocument.create();

  for (let i = 1; i <= doc.numPages; i++) {
    onPage(i, doc.numPages);
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext("2d", { alpha: false })!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    if (grayscale) {
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = img.data;
      for (let p = 0; p < d.length; p += 4) {
        const v = (d[p] * 0.299 + d[p + 1] * 0.587 + d[p + 2] * 0.114) | 0;
        d[p] = d[p + 1] = d[p + 2] = v;
      }
      ctx.putImageData(img, 0, 0);
    }
    const jpeg = await canvasToJpeg(canvas, quality);
    const embedded = await out.embedJpg(jpeg);
    const base = page.getViewport({ scale: 1 });
    const newPage = out.addPage([base.width, base.height]);
    newPage.drawImage(embedded, { x: 0, y: 0, width: base.width, height: base.height });
    canvas.width = canvas.height = 0;
    await new Promise((r) => setTimeout(r, 0));
  }

  doc.cleanup();
  return out;
}

function PdfCompressor() {
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const [stripMeta, setStripMeta] = useState(true);
  const [grayscale, setGrayscale] = useState(false);
  const [level, setLevel] = useState<Level>("balanced");
  const [status, setStatus] = useState<{ name: string; page: number; total: number } | null>(null);
  const [dpiHint, setDpiHint] = useState(100);

  const onFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setBusy(true);
    const out: Result[] = [];
    for (const f of Array.from(files)) {
      try {
        if (f.type && f.type !== "application/pdf") {
          toast.error(`${f.name} is not a PDF`);
          continue;
        }
        const buf = await f.arrayBuffer();
        let bytes: Uint8Array;
        let modeLabel: string;

        if (level === "lossless") {
          let pdf;
          try {
            pdf = await PDFDocument.load(buf, { updateMetadata: false });
          } catch (loadErr) {
            const msg = String((loadErr as Error)?.message || loadErr).toLowerCase();
            toast.error(
              msg.includes("encrypt") || msg.includes("password")
                ? `${f.name} is password-protected`
                : `${f.name} could not be read`,
              { description: "Remove the password or try another file." },
            );
            continue;
          }
          if (stripMeta) {
            pdf.setTitle(""); pdf.setAuthor(""); pdf.setSubject("");
            pdf.setKeywords([]); pdf.setProducer(""); pdf.setCreator("");
          }
          bytes = await pdf.save({ useObjectStreams: true, addDefaultPage: false });
          modeLabel = "Lossless rewrite";
        } else {
          setStatus({ name: f.name, page: 0, total: 0 });
          const doc = await rasterCompress(buf, level, grayscale, (page, total) =>
            setStatus({ name: f.name, page, total }),
          );
          if (stripMeta) {
            doc.setTitle(""); doc.setAuthor(""); doc.setSubject("");
            doc.setKeywords([]); doc.setProducer(""); doc.setCreator("");
          }
          bytes = await doc.save({ useObjectStreams: true });
          modeLabel = `${LEVELS[level].label}${grayscale ? " · grayscale" : ""}`;
        }

        const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
        if (blob.size >= f.size) {
          toast.info(`${f.name} is already highly optimized`, {
            description: "The result is still available — try a stronger level for more reduction.",
          });
        }
        out.push({
          name: f.name.replace(/\.pdf$/i, "") + ".min.pdf",
          original: f.size,
          compressed: blob.size,
          url: URL.createObjectURL(blob),
          mode: modeLabel,
        });
      } catch (e) {
        console.error(e);
        toast.error(`Failed: ${f.name}`, { description: "Unexpected error during compression." });
      }
    }
    setStatus(null);
    setResults(prev => [...out, ...prev]);
    setBusy(false);
    if (out.length) toast.success(`Compressed ${out.length} file(s)`);
  };

  return (
    <div className="container mx-auto max-w-5xl p-4 md:p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">PDF Compressor</h2>
        <p className="text-sm text-muted-foreground">Downsample pages, strip metadata and rewrite PDFs for fast web viewing — fully offline.</p>
      </div>

      <Card className="glass-panel p-5 space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Compression level</Label>
            <Select value={level} onValueChange={(v) => setLevel(v as Level)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lossless">Lossless rewrite (text stays selectable)</SelectItem>
                <SelectItem value="light">Light — best quality</SelectItem>
                <SelectItem value="balanced">Balanced — recommended</SelectItem>
                <SelectItem value="strong">Strong — smallest readable</SelectItem>
                <SelectItem value="extreme">Extreme — maximum shrink</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {level === "lossless"
                ? "Keeps text and links intact; only removes overhead."
                : "Pages are re-rendered as compressed images — text becomes non-selectable."}
            </p>
          </div>
          <div className="space-y-3">
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <div className="text-sm font-medium">Strip metadata</div>
                <div className="text-xs text-muted-foreground">Remove title, author, producer info</div>
              </div>
              <Switch checked={stripMeta} onCheckedChange={setStripMeta} />
            </label>
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <div className="text-sm font-medium">Grayscale</div>
                <div className="text-xs text-muted-foreground">Extra shrink for scans and documents</div>
              </div>
              <Switch checked={grayscale} disabled={level === "lossless"} onCheckedChange={setGrayscale} />
            </label>
          </div>
        </div>
        {level !== "lossless" && (
          <div className="space-y-2">
            <Label>Target detail <span className="text-muted-foreground">({dpiHint} DPI approx.)</span></Label>
            <Slider min={60} max={200} step={10} value={[dpiHint]} onValueChange={([v]) => setDpiHint(v)} />
            <p className="text-[11px] text-muted-foreground">Guidance only — the selected level controls the actual render scale.</p>
          </div>
        )}
      </Card>

      <Card
        className="glass-panel border-dashed border-2 border-border/60 hover:border-primary/50 p-10 text-center cursor-pointer transition-colors"
        onClick={() => !busy && document.getElementById("pdfin")?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (!busy) onFiles(e.dataTransfer.files); }}
      >
        {busy ? <Loader2 className="h-10 w-10 mx-auto mb-3 animate-spin" /> : <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />}
        <p className="font-medium">Drop PDF files or click to select</p>
        <p className="text-xs text-muted-foreground mt-1">Files never leave your device</p>
        <input id="pdfin" type="file" accept="application/pdf" multiple hidden onChange={(e) => { const el = e.currentTarget; const fl = el.files; void onFiles(fl).finally(() => { el.value = ""; }); }} />
      </Card>

      {status && (
        <Card className="glass-panel p-4 space-y-2">
          <Progress value={status.total ? (status.page / status.total) * 100 : 8} />
          <div className="text-xs text-muted-foreground text-center">
            {status.total ? `Compressing page ${status.page} of ${status.total}` : "Loading PDF engine…"}
            <div className="truncate text-[11px] mt-0.5">{status.name}</div>
          </div>
        </Card>
      )}

      {results.length > 0 && (
        <Card className="glass-panel divide-y divide-border/50">
          {results.map((r, i) => {
            const saved = Math.round((1 - r.compressed / r.original) * 100);
            return (
              <div key={i} className="flex items-center gap-3 p-4">
                <FileText className="h-8 w-8 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{r.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {fmt(r.original)} → <span className="text-success">{fmt(r.compressed)}</span> · {saved > 0 ? `${saved}% smaller` : "no reduction"} · {r.mode}
                  </div>
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
