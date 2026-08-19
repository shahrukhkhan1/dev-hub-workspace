import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { Upload, Download, Image as ImageIcon, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { sfx } from "@/lib/sfx";

export const Route = createFileRoute("/image")({
  head: () => ({
    meta: [
      { title: "Image Studio — DevSuite Hub" },
      { name: "description", content: "Bulk client-side image compression, resizing and format conversion to PNG, JPEG, WebP." },
      { property: "og:title", content: "Image Studio — DevSuite Hub" },
      { property: "og:description", content: "Compress, resize and convert images entirely in your browser." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ImageStudio,
});

interface Item {
  id: string;
  file: File;
  original: number;
  compressedSize?: number;
  url?: string;
  status: "pending" | "processing" | "done" | "error";
  outputName?: string;
  dims?: string;
}

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const fmt = (b: number) => b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b/1024).toFixed(1)} KB` : `${(b/1024/1024).toFixed(2)} MB`;

type OutFormat = "original" | "image/jpeg" | "image/png" | "image/webp";

async function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encoding failed"))), type, quality);
  });
}

async function renderResized(file: File, maxDim: number, enforce: boolean) {
  const bitmap = await createImageBitmap(file);
  const srcW = bitmap.width;
  const srcH = bitmap.height;
  const longest = Math.max(srcW, srcH);
  const scale = enforce && maxDim > 0 && longest > maxDim ? maxDim / longest : 1;
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return { canvas, w, h, srcW, srcH };
}

async function processImage(file: File, opts: { maxDim: number; resize: boolean; quality: number; format: OutFormat }) {
  const { canvas, w, h, srcW, srcH } = await renderResized(file, opts.maxDim, opts.resize);
  let type: string;
  if (opts.format === "original") {
    type = file.type === "image/png" ? "image/png" : file.type === "image/webp" ? "image/webp" : "image/jpeg";
  } else {
    type = opts.format;
  }
  // PNG is lossless: to still gain size on transparent-free art we fall back
  // to the canvas encoder's default. JPEG/WebP honour the quality argument.
  let blob = await toBlob(canvas, type, opts.quality);
  if (type === "image/png" && blob.size > file.size && opts.format === "original") {
    // Re-encoding PNG grew the file — keep the original bytes instead.
    blob = file;
  }
  const ext = type.split("/")[1] === "jpeg" ? "jpg" : type.split("/")[1];
  return { blob, ext, dims: `${srcW}×${srcH} → ${w}×${h}` };
}

function ImageStudio() {
  const [items, setItems] = useState<Item[]>([]);
  const [quality, setQuality] = useState(0.8);
  const [maxWidth, setMaxWidth] = useState(1920);
  const [resize, setResize] = useState(true);
  const [format, setFormat] = useState<OutFormat>("image/webp");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, name: "" });

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files).filter(f => f.type.startsWith("image/"));
    const accepted: Item[] = [];
    let rejected = 0;
    for (const f of incoming) {
      if (f.size > MAX_FILE_BYTES) {
        rejected++;
        toast.error(`${f.name} exceeds 50MB limit`, { description: `File is ${fmt(f.size)}` });
        continue;
      }
      accepted.push({ id: crypto.randomUUID(), file: f, original: f.size, status: "pending" });
    }
    if (accepted.length) setItems(prev => [...prev, ...accepted]);
    if (rejected && accepted.length) toast.warning(`Skipped ${rejected} oversized file(s)`);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    onFiles(e.dataTransfer.files);
  }, []);

  const process = async () => {
    const queue = items.filter(i => i.status !== "done");
    if (!queue.length) return;
    setBusy(true);
    setProgress({ current: 0, total: queue.length, name: "" });

    for (let i = 0; i < queue.length; i++) {
      const it = queue[i];
      setProgress({ current: i + 1, total: queue.length, name: it.file.name });
      setItems(prev => prev.map(p => p.id === it.id ? { ...p, status: "processing" } : p));
      try {
        const { blob, ext, dims } = await processImage(it.file, { maxDim: maxWidth, resize, quality, format });
        const baseName = it.file.name.replace(/\.[^.]+$/, "");
        const url = URL.createObjectURL(blob);
        const outputName = `${baseName}.${ext}`;
        setItems(prev => prev.map(p => p.id === it.id
          ? { ...p, status: "done", compressedSize: blob.size, url, outputName, dims }
          : p));
      } catch (e) {
        console.error(e);
        setItems(prev => prev.map(p => p.id === it.id ? { ...p, status: "error" } : p));
        toast.error(`Failed: ${it.file.name}`);
      }
      await new Promise(r => setTimeout(r, 0));
    }

    setBusy(false);
    setProgress({ current: 0, total: 0, name: "" });
    sfx.play("success");
    toast.success("Processing complete");
  };

  const downloadAll = () => {
    items.filter(i => i.url).forEach((i, idx) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = i.url!; a.download = i.outputName!; a.click();
      }, idx * 150);
    });
  };

  const totalOriginal = items.reduce((s, i) => s + i.original, 0);
  const totalCompressed = items.reduce((s, i) => s + (i.compressedSize ?? 0), 0);
  const savings = totalOriginal > 0 && totalCompressed > 0 ? Math.round((1 - totalCompressed / totalOriginal) * 100) : 0;

  return (
    <div className="container mx-auto max-w-7xl p-4 md:p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Image Studio</h2>
        <p className="text-sm text-muted-foreground">Compress, resize and convert images — entirely in your browser.</p>
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-6">
        <Card className="glass-panel p-5 space-y-5 h-fit">
          <div className="space-y-2">
            <Label>Quality <span className="text-muted-foreground">({Math.round(quality * 100)}%)</span></Label>
            <Slider min={0.1} max={1} step={0.05} value={[quality]} onValueChange={([v]) => setQuality(v)} />
            <p className="text-[11px] text-muted-foreground">Applies to JPEG and WebP output. PNG is lossless.</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="resize-toggle">Resize images</Label>
              <Switch id="resize-toggle" checked={resize} onCheckedChange={setResize} />
            </div>
            <Input
              type="number"
              min={16}
              value={maxWidth}
              disabled={!resize}
              onChange={(e) => setMaxWidth(Math.max(16, Number(e.target.value) || 0))}
            />
            <p className="text-[11px] text-muted-foreground">Longest side is scaled down to this many pixels.</p>
          </div>
          <div className="space-y-2">
            <Label>Output format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as OutFormat)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="original">Original</SelectItem>
                <SelectItem value="image/webp">WebP</SelectItem>
                <SelectItem value="image/jpeg">JPEG</SelectItem>
                <SelectItem value="image/png">PNG</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button data-sfx onClick={process} disabled={!items.length || busy} className="w-full active:scale-95 transition-transform">
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Process {items.length || ""}
          </Button>
          {busy && progress.total > 0 && (
            <div className="space-y-2">
              <Progress value={(progress.current / progress.total) * 100} />
              <div className="text-xs text-muted-foreground text-center">
                Processing image {progress.current} of {progress.total}
                <div className="truncate text-[11px] mt-0.5">{progress.name}</div>
              </div>
            </div>
          )}
          {items.some(i => i.url) && (
            <Button data-sfx onClick={downloadAll} variant="outline" className="w-full active:scale-95 transition-transform">
              <Download className="h-4 w-4 mr-2" /> Download all
            </Button>
          )}
          {savings > 0 && (
            <div className="rounded-lg bg-success/10 border border-success/30 p-3 text-center">
              <div className="text-2xl font-bold text-success">{savings}%</div>
              <div className="text-xs text-muted-foreground">size reduction</div>
              <div className="text-[11px] text-muted-foreground mt-1">{fmt(totalOriginal)} → {fmt(totalCompressed)}</div>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card
            className="glass-panel border-dashed border-2 border-border/60 hover:border-primary/50 transition-colors p-10 text-center cursor-pointer"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => document.getElementById("imgin")?.click()}
          >
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">Drop images here or click to upload</p>
            <p className="text-xs text-muted-foreground mt-1">PNG, JPEG, WebP, AVIF · Max 50MB per file · Sequential processing</p>
            <input id="imgin" type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
          </Card>

          {items.length > 0 && (
            <Card className="glass-panel divide-y divide-border/50 overflow-hidden">
              {items.map((it) => (
                <div key={it.id} className="flex items-center gap-3 p-3">
                  <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {it.url ? <img src={it.url} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{it.outputName ?? it.file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmt(it.original)}
                      {it.compressedSize ? <> → <span className="text-success">{fmt(it.compressedSize)}</span></> : null}
                      {it.dims ? <span className="ml-2 opacity-70">{it.dims}</span> : null}
                    </div>
                  </div>
                  {it.url && (
                    <Button size="icon" variant="ghost" asChild>
                      <a href={it.url} download={it.outputName}><Download className="h-4 w-4" /></a>
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => setItems(prev => prev.filter(p => p.id !== it.id))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
