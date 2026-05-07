import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { sfx } from "@/lib/sfx";

export const Route = createFileRoute("/password")({
  head: () => ({
    meta: [
      { title: "Password & UUID Generator — DevSuite Hub" },
      { name: "description", content: "Cryptographically-secure password, token, hash and UUIDv4 generator. 100% client-side." },
    ],
  }),
  component: PasswordTool,
});

const A = "abcdefghijklmnopqrstuvwxyz";
const B = A.toUpperCase();
const N = "0123456789";
const S = "!@#$%^&*()-_=+[]{}<>?";

function genPassword(len: number, opts: { upper: boolean; numbers: boolean; symbols: boolean }) {
  let pool = A;
  if (opts.upper) pool += B;
  if (opts.numbers) pool += N;
  if (opts.symbols) pool += S;
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < len; i++) out += pool[arr[i] % pool.length];
  return out;
}

async function hash(text: string, algo: "SHA-1" | "SHA-256" | "SHA-512") {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest(algo, data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function PasswordTool() {
  const [len, setLen] = useState(20);
  const [upper, setUpper] = useState(true);
  const [numbers, setNumbers] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [pwd, setPwd] = useState(() => genPassword(20, { upper: true, numbers: true, symbols: true }));
  const [uuid, setUuid] = useState(() => crypto.randomUUID());
  const [tokenLen, setTokenLen] = useState(32);
  const [token, setToken] = useState(() => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join(""));
  const [hashIn, setHashIn] = useState("");
  const [hashes, setHashes] = useState({ sha1: "", sha256: "", sha512: "" });

  const regen = () => { const p = genPassword(len, { upper, numbers, symbols }); setPwd(p); sfx.play("click"); };
  const regenUuid = () => { setUuid(crypto.randomUUID()); sfx.play("click"); };
  const regenToken = () => {
    setToken(Array.from(crypto.getRandomValues(new Uint8Array(tokenLen)), b => b.toString(16).padStart(2, "0")).join(""));
    sfx.play("click");
  };
  const computeHash = async () => {
    const [s1, s2, s5] = await Promise.all([hash(hashIn, "SHA-1"), hash(hashIn, "SHA-256"), hash(hashIn, "SHA-512")]);
    setHashes({ sha1: s1, sha256: s2, sha512: s5 });
    sfx.play("success");
  };
  const copy = (v: string) => { navigator.clipboard.writeText(v); sfx.play("success"); toast.success("Copied to clipboard"); };

  const strength = Math.min(100, Math.round((len * Math.log2((upper ? 26 : 0) + 26 + (numbers ? 10 : 0) + (symbols ? S.length : 0))) / 1.28));

  return (
    <div className="container mx-auto max-w-5xl p-4 md:p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Password & UUID</h2>
        <p className="text-sm text-muted-foreground">All values are generated locally with the Web Crypto API.</p>
      </div>

      <Tabs defaultValue="password">
        <TabsList>
          <TabsTrigger value="password">Password</TabsTrigger>
          <TabsTrigger value="uuid">UUIDv4</TabsTrigger>
          <TabsTrigger value="token">Hex Token</TabsTrigger>
          <TabsTrigger value="hash">Hash</TabsTrigger>
        </TabsList>

        <TabsContent value="password">
          <Card className="glass-panel p-5 space-y-5">
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 font-mono text-sm break-all">
              {pwd}
              <Button data-sfx variant="ghost" size="icon" onClick={() => copy(pwd)} className="ml-auto active:scale-90 transition-transform"><Copy className="h-4 w-4" /></Button>
              <Button data-sfx variant="ghost" size="icon" onClick={regen} className="active:scale-90 transition-transform"><RefreshCw className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-2">
              <Label>Length: {len}</Label>
              <Slider min={8} max={64} step={1} value={[len]} onValueChange={([v]) => setLen(v)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <label className="flex items-center justify-between"><span>A-Z</span><Switch checked={upper} onCheckedChange={setUpper} /></label>
              <label className="flex items-center justify-between"><span>0-9</span><Switch checked={numbers} onCheckedChange={setNumbers} /></label>
              <label className="flex items-center justify-between"><span>Symbols</span><Switch checked={symbols} onCheckedChange={setSymbols} /></label>
            </div>
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1"><span>Strength</span><span>{strength}%</span></div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full transition-all" style={{ width: `${strength}%`, background: strength > 75 ? "var(--success)" : strength > 45 ? "var(--warning)" : "var(--destructive)" }} />
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="uuid">
          <Card className="glass-panel p-5 space-y-3">
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 font-mono text-sm">
              {uuid}
              <Button data-sfx variant="ghost" size="icon" onClick={() => copy(uuid)} className="ml-auto active:scale-90 transition-transform"><Copy className="h-4 w-4" /></Button>
              <Button data-sfx variant="ghost" size="icon" onClick={regenUuid} className="active:scale-90 transition-transform"><RefreshCw className="h-4 w-4" /></Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="token">
          <Card className="glass-panel p-5 space-y-3">
            <div className="space-y-2">
              <Label>Token bytes: {tokenLen}</Label>
              <Slider min={8} max={64} step={1} value={[tokenLen]} onValueChange={([v]) => setTokenLen(v)} />
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 font-mono text-xs break-all">
              {token}
              <Button data-sfx variant="ghost" size="icon" onClick={() => copy(token)} className="ml-auto active:scale-90 transition-transform"><Copy className="h-4 w-4" /></Button>
              <Button data-sfx variant="ghost" size="icon" onClick={regenToken} className="active:scale-90 transition-transform"><RefreshCw className="h-4 w-4" /></Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="hash">
          <Card className="glass-panel p-5 space-y-3">
            <Input value={hashIn} onChange={(e) => setHashIn(e.target.value)} placeholder="Type any text..." />
            <Button data-sfx onClick={computeHash} disabled={!hashIn} className="active:scale-95 transition-transform">Compute hashes</Button>
            {(["sha1","sha256","sha512"] as const).map((k) => (
              hashes[k] ? (
                <div key={k} className="space-y-1">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</div>
                  <div className="flex items-center gap-2 rounded-md bg-muted/50 p-2 font-mono text-xs break-all">
                    {hashes[k]}
                    <Button data-sfx variant="ghost" size="icon" onClick={() => copy(hashes[k])} className="ml-auto active:scale-90 transition-transform"><Copy className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ) : null
            ))}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
