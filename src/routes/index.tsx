import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import imageCompression from "browser-image-compression";
import { Upload, Download, Image as ImageIcon, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Image Studio — DevSuite Hub" },
      { name: "description", content: "Bulk client-side image compression, resizing and format conversion to PNG, JPEG, WebP & AVIF." },
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
}

const fmt = (b: number) => b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b/1024).toFixed(1)} KB` : `${(b/1024/1024).toFixed(2)} MB`;

function ImageStudio() {
  const [items, setItems] = useState<Item[]>([]);
  const [quality, setQuality] = useState(0.8);
  const [maxWidth, setMaxWidth] = useState(1920);
  const [format, setFormat] = useState<"original" | "image/jpeg" | "image/png" | "image/webp">("image/webp");
  const [busy, setBusy] = useState(false);

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    const next: Item[] = Array.from(files).filter(f => f.type.startsWith("image/")).map(f => ({
      id: crypto.randomUUID(), file: f, original: f.size, status: "pending",
    }));
    setItems(prev => [...prev, ...next]);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    onFiles(e.dataTransfer.files);
  }, []);

  const process = async () => {
    setBusy(true);
    const updated = await Promise.all(items.map(async (it) => {
      if (it.status === "done") return it;
      try {
        const fileType = format === "original" ? undefined : format;
        const compressed = await imageCompression(it.file, {
          maxSizeMB: 50,
          maxWidthOrHeight: maxWidth,
          useWebWorker: true,
          initialQuality: quality,
          fileType,
        });
        const ext = (fileType ?? it.file.type).split("/")[1] || "jpg";
        const baseName = it.file.name.replace(/\.[^.]+$/, "");
        return { ...it, status: "done" as const, compressedSize: compressed.size, url: URL.createObjectURL(compressed), outputName: `${baseName}.${ext}` };
      } catch (e) {
        console.error(e);
        return { ...it, status: "error" as const };
      }
    }));
    setItems(updated);
    setBusy(false);
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
          </div>
          <div className="space-y-2">
            <Label>Max width / height (px)</Label>
            <Input type="number" value={maxWidth} onChange={(e) => setMaxWidth(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Output format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as typeof format)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="original">Original</SelectItem>
                <SelectItem value="image/webp">WebP</SelectItem>
                <SelectItem value="image/jpeg">JPEG</SelectItem>
                <SelectItem value="image/png">PNG</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={process} disabled={!items.length || busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Process {items.length || ""}
          </Button>
          {items.some(i => i.url) && (
            <Button onClick={downloadAll} variant="outline" className="w-full">
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
            <p className="text-xs text-muted-foreground mt-1">Supports PNG, JPEG, WebP, AVIF · Bulk processing</p>
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
