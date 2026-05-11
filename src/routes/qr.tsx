import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Download } from "lucide-react";
import { sfx } from "@/lib/sfx";
import { toast } from "sonner";

export const Route = createFileRoute("/qr")({
  head: () => ({
    meta: [
      { title: "QR Code Studio — DevSuite Hub" },
      { name: "description", content: "Generate beautiful, custom-colored QR codes and download them as PNG or SVG." },
    ],
  }),
  component: QRStudio,
});

function QRStudio() {
  const [text, setText] = useState("https://dev-hub-workspace.shahrukh-khan1766.workers.dev/");
  const [fg, setFg] = useState("#0ea5e9");
  const [bg, setBg] = useState("#0b1220");
  const [size, setSize] = useState(320);
  const [margin, setMargin] = useState(2);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [svg, setSvg] = useState("");

  useEffect(() => {
    if (!canvasRef.current || !text) return;
    QRCode.toCanvas(canvasRef.current, text, { width: size, margin, color: { dark: fg, light: bg }, errorCorrectionLevel: "H" }).catch(() => {});
    QRCode.toString(text, { type: "svg", margin, color: { dark: fg, light: bg }, errorCorrectionLevel: "H" }).then(setSvg).catch(() => {});
  }, [text, fg, bg, size, margin]);

  const downloadPng = () => {
    if (!canvasRef.current) return;
    const a = document.createElement("a");
    a.href = canvasRef.current.toDataURL("image/png");
    a.download = "qr.png"; a.click();
    sfx.play("success"); toast.success("PNG downloaded");
  };
  const downloadSvg = () => {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "qr.svg"; a.click();
    sfx.play("success"); toast.success("SVG downloaded");
  };

  return (
    <div className="container mx-auto max-w-6xl p-4 md:p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">QR Code Studio</h2>
        <p className="text-sm text-muted-foreground">Customize colors and size — export as PNG or SVG.</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <Card className="glass-panel flex items-center justify-center p-8">
          <div className="rounded-2xl p-6 shadow-card transition-transform hover:scale-[1.02]" style={{ background: bg }}>
            <canvas ref={canvasRef} className="block" />
          </div>
        </Card>

        <Card className="glass-panel p-5 space-y-5 h-fit">
          <div className="space-y-2">
            <Label>Content</Label>
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="URL or any text..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Foreground</Label>
              <div className="flex gap-2">
                <input type="color" value={fg} onChange={(e) => setFg(e.target.value)} className="h-9 w-12 rounded border border-border bg-transparent" />
                <Input value={fg} onChange={(e) => setFg(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Background</Label>
              <div className="flex gap-2">
                <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="h-9 w-12 rounded border border-border bg-transparent" />
                <Input value={bg} onChange={(e) => setBg(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Size: {size}px</Label>
            <Slider min={128} max={640} step={16} value={[size]} onValueChange={([v]) => setSize(v)} />
          </div>
          <div className="space-y-2">
            <Label>Quiet zone: {margin}</Label>
            <Slider min={0} max={8} step={1} value={[margin]} onValueChange={([v]) => setMargin(v)} />
          </div>
          <div className="flex gap-2">
            <Button data-sfx onClick={downloadPng} className="flex-1 active:scale-95 transition-transform"><Download className="h-4 w-4 mr-1" /> PNG</Button>
            <Button data-sfx onClick={downloadSvg} variant="secondary" className="flex-1 active:scale-95 transition-transform"><Download className="h-4 w-4 mr-1" /> SVG</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
