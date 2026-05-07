import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Copy } from "lucide-react";
import { sfx } from "@/lib/sfx";
import { toast } from "sonner";

export const Route = createFileRoute("/css")({
  head: () => ({
    meta: [
      { title: "CSS Design Helper — DevSuite Hub" },
      { name: "description", content: "Generate gradients, box-shadows and glassmorphism CSS visually with one-click copy." },
    ],
  }),
  component: CssHelper,
});

function CodeBlock({ code }: { code: string }) {
  const copy = () => { navigator.clipboard.writeText(code); sfx.play("success"); toast.success("CSS copied"); };
  return (
    <div className="relative">
      <pre className="rounded-lg bg-muted/40 p-4 text-xs font-mono overflow-auto border border-border/60">{code}</pre>
      <Button data-sfx size="sm" variant="ghost" onClick={copy} className="absolute top-2 right-2 active:scale-95 transition-transform"><Copy className="h-3.5 w-3.5 mr-1" /> Copy</Button>
    </div>
  );
}

function ShadowTool() {
  const [x, setX] = useState(0), [y, setY] = useState(20), [blur, setBlur] = useState(40), [spread, setSpread] = useState(-10);
  const [color, setColor] = useState("#0ea5e9"), [opacity, setOpacity] = useState(40);
  const css = `box-shadow: ${x}px ${y}px ${blur}px ${spread}px ${color}${Math.round(opacity * 2.55).toString(16).padStart(2, "0")};`;
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card className="glass-panel p-10 flex items-center justify-center min-h-[320px]">
        <div className="h-32 w-32 rounded-2xl bg-card" style={{ boxShadow: `${x}px ${y}px ${blur}px ${spread}px ${color}${Math.round(opacity * 2.55).toString(16).padStart(2, "0")}` }} />
      </Card>
      <Card className="glass-panel p-5 space-y-4">
        {[["X", x, setX, -50, 50], ["Y", y, setY, -50, 50], ["Blur", blur, setBlur, 0, 100], ["Spread", spread, setSpread, -50, 50]].map(([label, val, setter, min, max]: any) => (
          <div key={label} className="space-y-2">
            <Label>{label}: {val}px</Label>
            <Slider min={min} max={max} value={[val]} onValueChange={([v]) => setter(v)} />
          </div>
        ))}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>Color</Label><Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 p-1" /></div>
          <div className="space-y-2"><Label>Opacity: {opacity}%</Label><Slider min={0} max={100} value={[opacity]} onValueChange={([v]) => setOpacity(v)} /></div>
        </div>
        <CodeBlock code={css} />
      </Card>
    </div>
  );
}

function GradientTool() {
  const [from, setFrom] = useState("#06b6d4"), [to, setTo] = useState("#a855f7"), [angle, setAngle] = useState(135);
  const css = `background: linear-gradient(${angle}deg, ${from}, ${to});`;
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card className="glass-panel p-2 min-h-[320px]">
        <div className="h-full w-full rounded-lg" style={{ background: `linear-gradient(${angle}deg, ${from}, ${to})`, minHeight: 300 }} />
      </Card>
      <Card className="glass-panel p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>From</Label><Input type="color" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 p-1" /></div>
          <div className="space-y-2"><Label>To</Label><Input type="color" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 p-1" /></div>
        </div>
        <div className="space-y-2"><Label>Angle: {angle}°</Label><Slider min={0} max={360} value={[angle]} onValueChange={([v]) => setAngle(v)} /></div>
        <CodeBlock code={css} />
      </Card>
    </div>
  );
}

function GlassTool() {
  const [blur, setBlur] = useState(20), [opacity, setOpacity] = useState(8), [border, setBorder] = useState(15), [radius, setRadius] = useState(16);
  const css = useMemo(() => `background: rgba(255,255,255,${(opacity / 100).toFixed(2)});
backdrop-filter: blur(${blur}px) saturate(140%);
-webkit-backdrop-filter: blur(${blur}px) saturate(140%);
border: 1px solid rgba(255,255,255,${(border / 100).toFixed(2)});
border-radius: ${radius}px;`, [blur, opacity, border, radius]);
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card className="p-10 flex items-center justify-center min-h-[320px]" style={{ background: "linear-gradient(135deg,#06b6d4,#a855f7)" }}>
        <div className="h-44 w-60 flex items-center justify-center text-white font-medium" style={{
          background: `rgba(255,255,255,${opacity / 100})`,
          backdropFilter: `blur(${blur}px) saturate(140%)`,
          border: `1px solid rgba(255,255,255,${border / 100})`,
          borderRadius: `${radius}px`,
        }}>Glass panel</div>
      </Card>
      <Card className="glass-panel p-5 space-y-4">
        {[["Blur", blur, setBlur, 0, 50], ["Tint %", opacity, setOpacity, 0, 60], ["Border %", border, setBorder, 0, 60], ["Radius", radius, setRadius, 0, 40]].map(([l, v, s, mn, mx]: any) => (
          <div key={l} className="space-y-2"><Label>{l}: {v}</Label><Slider min={mn} max={mx} value={[v]} onValueChange={([nv]) => s(nv)} /></div>
        ))}
        <CodeBlock code={css} />
      </Card>
    </div>
  );
}

function CssHelper() {
  return (
    <div className="container mx-auto max-w-6xl p-4 md:p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">CSS Design Helper</h2>
        <p className="text-sm text-muted-foreground">Visual generators with live previews and one-click copy.</p>
      </div>
      <Tabs defaultValue="gradient">
        <TabsList>
          <TabsTrigger value="gradient">Gradient</TabsTrigger>
          <TabsTrigger value="shadow">Box Shadow</TabsTrigger>
          <TabsTrigger value="glass">Glassmorphism</TabsTrigger>
        </TabsList>
        <TabsContent value="gradient" className="mt-4"><GradientTool /></TabsContent>
        <TabsContent value="shadow" className="mt-4"><ShadowTool /></TabsContent>
        <TabsContent value="glass" className="mt-4"><GlassTool /></TabsContent>
      </Tabs>
    </div>
  );
}
