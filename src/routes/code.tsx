import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import LZString from "lz-string";
import html2canvas from "html2canvas";
import { Play, Save, Share2, Camera, Plus, FileCode, Trash2, Package, Loader2, WifiOff, Terminal, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { db } from "@/lib/db";

export const Route = createFileRoute("/code")({
  head: () => ({
    meta: [
      { title: "Code Playground — DevSuite Hub" },
      { name: "description", content: "Multi-language client-side code playground with React, Python (Pyodide), CDN injection and shareable URLs." },
    ],
  }),
  component: Playground,
});

type Runtime = "html" | "react" | "python";
type LogLevel = "log" | "warn" | "error" | "info";
interface LogEntry { level: LogLevel; text: string; ts: number; }

const PRESETS: Record<string, string> = {
  "Tailwind CSS": "https://cdn.tailwindcss.com",
  "jQuery": "https://code.jquery.com/jquery-3.7.1.min.js",
  "Bootstrap CSS": "https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css",
  "FontAwesome": "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css",
};

const STARTERS: Record<Runtime, Record<string, string>> = {
  html: {
    "index.html": `<!DOCTYPE html>\n<html>\n<head><title>Hello</title></head>\n<body>\n  <h1 id="t">Hello DevSuite</h1>\n  <script src="script.js"></script>\n</body>\n</html>`,
    "style.css": `body { font-family: system-ui; padding: 2rem; background:#0f172a; color:#fff; }\nh1 { color: #38bdf8; }`,
    "script.js": `document.getElementById('t').onclick = () => console.log('Clicked!');`,
  },
  react: {
    "App.jsx": `function App() {\n  const [n, setN] = React.useState(0);\n  return (\n    <div style={{padding:32,fontFamily:'system-ui'}}>\n      <h1>React Counter</h1>\n      <button onClick={() => setN(n+1)}>Count: {n}</button>\n    </div>\n  );\n}\nReactDOM.createRoot(document.getElementById('root')).render(<App />);`,
  },
  python: {
    "main.py": `import sys\nprint("Hello from Python!")\nfor i in range(5):\n    print(f"i = {i}, squared = {i*i}")`,
  },
};

// Loop-protection harness shared by HTML/React iframes.
// - Instruments for/while/do loops with a wall-clock timeout (default 3s).
// - Routes console + uncaught errors back to the parent via postMessage,
//   so they appear in our custom console panel and don't pollute the host devtools.
const HARNESS = `<script>
(function(){
  const send = (level, args) => {
    try {
      const text = Array.from(args).map(a => {
        if (a instanceof Error) return a.stack || a.message;
        if (typeof a === 'object') { try { return JSON.stringify(a); } catch { return String(a); } }
        return String(a);
      }).join(' ');
      parent.postMessage({ __devsuite: true, level, text }, '*');
    } catch {}
  };
  ['log','info','warn','error','debug'].forEach(k => {
    const orig = console[k];
    console[k] = function(){ send(k === 'debug' ? 'log' : k, arguments); try { orig && orig.apply(console, arguments); } catch {} };
  });
  window.addEventListener('error', e => { send('error', [e.message + ' (' + (e.filename||'') + ':' + (e.lineno||0) + ')']); });
  window.addEventListener('unhandledrejection', e => { send('error', ['Unhandled promise rejection: ' + (e.reason && e.reason.stack || e.reason)]); });
  window.__lpGuard = (function(){
    const start = Date.now();
    return function(){
      if (Date.now() - start > 3000) {
        throw new Error('Execution aborted: script ran for more than 3 seconds (possible infinite loop)');
      }
    };
  })();
})();
<\/script>`;

function instrumentLoops(src: string): string {
  // Insert __lpGuard() at the top of every for/while/do body. Heuristic but
  // catches the typical infinite-loop shapes without a full JS parser.
  return src
    .replace(/\b(for|while)\s*\(([^)]*)\)\s*\{/g, "$&\nwindow.__lpGuard();")
    .replace(/\bdo\s*\{/g, "$&\nwindow.__lpGuard();");
}

function wrapJs(userJs: string): string {
  const safe = instrumentLoops(userJs);
  // Wrap all user JS in try/catch so a thrown error becomes a clean console
  // entry instead of an uncaught exception that breaks downstream init.
  return `try {\n${safe}\n} catch (e) { console.error(e); }`;
}

function buildHtml(runtime: Runtime, files: Record<string,string>, cdns: string[], offline: boolean) {
  // When offline we drop external CDN tags entirely — the user is told via UI
  // and we keep the runtime usable for plain HTML/CSS/JS and Python (cached).
  const effectiveCdns = offline ? [] : cdns;
  const cdnTags = effectiveCdns.map(u => u.endsWith(".css")
    ? `<link rel="stylesheet" href="${u}">`
    : `<script src="${u}"></script>`).join("\n");

  if (runtime === "html") {
    let html = files["index.html"] || "<!DOCTYPE html><html><body></body></html>";
    const css = files["style.css"] || "";
    const js = wrapJs(files["script.js"] || "");
    html = html.replace("<script src=\"script.js\"></script>", `<script>${js}<\/script>`);
    if (css) html = html.replace("</head>", `<style>${css}<\/style></head>`);
    if (cdnTags) html = html.replace("</head>", `${cdnTags}</head>`);
    html = html.replace("</head>", `${HARNESS}</head>`);
    if (!html.includes("</head>")) {
      html = html.replace("<body>", `<head>${HARNESS}${cdnTags}<style>${css}<\/style></head><body>`);
    }
    return html;
  }
  if (runtime === "react") {
    const code = wrapJs(Object.values(files).join("\n\n"));
    return `<!DOCTYPE html><html><head>${HARNESS}${cdnTags}
<script src="https://unpkg.com/react@18/umd/react.development.js"><\/script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
</head><body><div id="root"></div>
<script type="text/babel" data-presets="env,react">${code}<\/script>
</body></html>`;
  }
  // Python: route stdout/stderr via postMessage so it appears in our console
  // panel and never leaks into the browser devtools.
  const code = files["main.py"] || "";
  const escaped = JSON.stringify(code);
  return `<!DOCTYPE html><html><head>${cdnTags}
<script src="https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js"><\/script>
<style>body{font-family:ui-monospace,monospace;background:#0b1220;color:#e2e8f0;padding:16px;margin:0;white-space:pre-wrap;font-size:13px;}</style>
</head><body id="status">Loading Python runtime...
<script>
(async () => {
  const status = document.getElementById('status');
  const post = (level, text) => { try { parent.postMessage({ __devsuite: true, level, text }, '*'); } catch {} };
  try {
    if (typeof loadPyodide !== 'function') {
      status.textContent = 'Pyodide CDN unavailable (offline?). Connect to the internet once to cache it, then retry.';
      post('error', 'Pyodide CDN unavailable.');
      return;
    }
    const py = await loadPyodide();
    status.textContent = 'Python ready. See console below for output.';
    py.setStdout({ batched: (s) => post('log', s) });
    py.setStderr({ batched: (s) => post('error', s) });
    try { await py.runPythonAsync(${escaped}); post('info', '[python] script complete'); }
    catch (e) { post('error', String(e && e.message || e)); }
  } catch (e) { post('error', 'Pyodide failed to load: ' + (e && e.message || e)); status.textContent = 'Failed to load Python runtime.'; }
})();
<\/script></body></html>`;
}

function Playground() {
  const [runtime, setRuntime] = useState<Runtime>("html");
  const [files, setFiles] = useState<Record<string,string>>(STARTERS.html);
  const [activeFile, setActiveFile] = useState("index.html");
  const [cdns, setCdns] = useState<string[]>([]);
  const [cdnInput, setCdnInput] = useState("");
  const [projectName, setProjectName] = useState("Untitled project");
  const [projects, setProjects] = useState<Array<{ id: number; name: string }>>([]);
  const [running, setRunning] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [srcDoc, setSrcDoc] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  // Online/offline awareness — drives CDN injection + UI affordances.
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);

  // Listen for log/error messages emitted by the sandbox iframe.
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const d = e.data;
      if (!d || !d.__devsuite) return;
      setLogs(prev => [...prev.slice(-499), { level: d.level as LogLevel, text: String(d.text ?? ""), ts: Date.now() }]);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash.startsWith("s=")) {
      try {
        const json = LZString.decompressFromEncodedURIComponent(hash.slice(2));
        if (json) {
          const data = JSON.parse(json);
          setRuntime(data.runtime); setFiles(data.files); setCdns(data.cdns || []);
          setActiveFile(Object.keys(data.files)[0]);
          toast.success("Loaded shared snippet");
        }
      } catch {}
    }
    refreshProjects();
  }, []);

  const refreshProjects = async () => {
    const list = await db.projects.orderBy("updatedAt").reverse().toArray();
    setProjects(list.map(p => ({ id: p.id!, name: p.name })));
  };

  const switchRuntime = (r: Runtime) => {
    setRuntime(r);
    setFiles(STARTERS[r]);
    setActiveFile(Object.keys(STARTERS[r])[0]);
  };

  const run = () => {
    setRunning(true);
    setLogs([]);
    setSrcDoc(buildHtml(runtime, files, cdns, !online));
    setTimeout(() => setRunning(false), 300);
  };

  const addFile = () => {
    const name = prompt("File name:");
    if (!name) return;
    setFiles(f => ({ ...f, [name]: "" }));
    setActiveFile(name);
  };

  const removeFile = (name: string) => {
    if (Object.keys(files).length <= 1) return;
    setFiles(f => { const { [name]: _, ...rest } = f; return rest; });
    setActiveFile(Object.keys(files).filter(k => k !== name)[0]);
  };

  const addCdn = (url: string) => {
    if (!url) return;
    setCdns(c => c.includes(url) ? c : [...c, url]);
    setCdnInput("");
  };

  const save = async () => {
    await db.projects.add({ name: projectName, files, cdns, updatedAt: Date.now() });
    toast.success("Project saved");
    refreshProjects();
  };

  const load = async (id: number) => {
    const p = await db.projects.get(id);
    if (!p) return;
    setProjectName(p.name); setFiles(p.files); setCdns(p.cdns);
    setActiveFile(Object.keys(p.files)[0]);
    toast.success(`Loaded ${p.name}`);
  };

  const share = async () => {
    const data = { runtime, files, cdns };
    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(data));
    const url = `${window.location.origin}${window.location.pathname}#s=${compressed}`;
    await navigator.clipboard.writeText(url);
    toast.success("Share link copied to clipboard");
  };

  const screenshot = async () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument?.body) return toast.error("Run code first");
    try {
      const canvas = await html2canvas(iframe.contentDocument.body, { useCORS: true, backgroundColor: null });
      const a = document.createElement("a");
      a.download = "preview.png"; a.href = canvas.toDataURL("image/png"); a.click();
    } catch (e) { console.error(e); toast.error("Screenshot failed"); }
  };

  const language = useMemo(() => {
    const ext = activeFile.split(".").pop();
    return ({ js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript", py: "python", html: "html", css: "css", json: "json" } as Record<string,string>)[ext || ""] || "plaintext";
  }, [activeFile]);

  const cdnsDisabled = !online;

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border/60 glass-panel">
        <Input className="w-48 h-8" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
        <Tabs value={runtime} onValueChange={(v) => switchRuntime(v as Runtime)}>
          <TabsList className="h-8">
            <TabsTrigger value="html" className="text-xs">HTML/CSS/JS</TabsTrigger>
            <TabsTrigger value="react" className="text-xs">React</TabsTrigger>
            <TabsTrigger value="python" className="text-xs">Python</TabsTrigger>
          </TabsList>
        </Tabs>

        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={cdnsDisabled} title={cdnsDisabled ? "Offline — CDN injection disabled" : ""}>
              {cdnsDisabled ? <WifiOff className="h-3.5 w-3.5 mr-1" /> : <Package className="h-3.5 w-3.5 mr-1" />}
              CDNs ({cdns.length})
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>External Dependencies</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {Object.entries(PRESETS).map(([name, url]) => (
                  <Button key={name} size="sm" variant="secondary" onClick={() => addCdn(url)}>+ {name}</Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input placeholder="https://esm.sh/lodash or any CDN URL" value={cdnInput} onChange={(e) => setCdnInput(e.target.value)} />
                <Button onClick={() => addCdn(cdnInput)}>Add</Button>
              </div>
              <div className="space-y-1">
                {cdns.map(u => (
                  <div key={u} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1">
                    <span className="flex-1 truncate font-mono">{u}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setCdns(c => c.filter(x => x !== u))}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <div className="ml-auto flex items-center gap-2">
          {!online && (
            <span className="flex items-center gap-1 text-[11px] text-warning"><WifiOff className="h-3 w-3" /> Offline</span>
          )}
          {projects.length > 0 && (
            <Select onValueChange={(v) => load(Number(v))}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Open project" /></SelectTrigger>
              <SelectContent>
                {projects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" variant="outline" onClick={save}><Save className="h-3.5 w-3.5 mr-1" /> Save</Button>
          <Button size="sm" variant="outline" onClick={share}><Share2 className="h-3.5 w-3.5 mr-1" /> Share</Button>
          <Button size="sm" variant="outline" onClick={screenshot}><Camera className="h-3.5 w-3.5 mr-1" /> Capture</Button>
          <Button size="sm" onClick={run}>{running ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1" />} Run</Button>
        </div>
      </div>

      <div className="flex-1 grid md:grid-cols-2 min-h-0">
        <div className="flex flex-col border-r border-border/60 min-h-0">
          <div className="flex items-center gap-1 px-2 py-1 border-b border-border/60 overflow-x-auto">
            {Object.keys(files).map(name => (
              <button
                key={name}
                onClick={() => setActiveFile(name)}
                className={`group flex items-center gap-1 px-2 py-1 rounded text-xs whitespace-nowrap ${activeFile === name ? "bg-accent text-accent-foreground" : "hover:bg-muted/50"}`}
              >
                <FileCode className="h-3 w-3" />{name}
                {Object.keys(files).length > 1 && (
                  <span onClick={(e) => { e.stopPropagation(); removeFile(name); }} className="opacity-0 group-hover:opacity-100 ml-1"><Trash2 className="h-3 w-3" /></span>
                )}
              </button>
            ))}
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={addFile}><Plus className="h-3 w-3" /></Button>
          </div>
          <div className="flex-1 min-h-0">
            <Editor
              key={activeFile}
              theme="vs-dark"
              language={language}
              value={files[activeFile] ?? ""}
              onChange={(v) => setFiles(f => ({ ...f, [activeFile]: v ?? "" }))}
              options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false, automaticLayout: true, tabSize: 2 }}
            />
          </div>
        </div>
        <div className="flex flex-col min-h-0">
          <div className="flex-1 bg-white relative min-h-0">
            {srcDoc ? (
              <iframe
                ref={iframeRef}
                title="preview"
                sandbox="allow-scripts allow-modals"
                srcDoc={srcDoc}
                className="w-full h-full border-0"
              />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground bg-card text-sm">Click <span className="font-semibold mx-1">Run</span> to preview</div>
            )}
          </div>
          <div className="h-44 border-t border-border/60 bg-card flex flex-col min-h-0">
            <div className="flex items-center justify-between px-3 py-1 border-b border-border/60">
              <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Terminal className="h-3 w-3" /> Console <span className="text-[10px]">({logs.length})</span>
              </div>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setLogs([])}>
                <Trash className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto font-mono text-[11px] p-2 space-y-0.5">
              {logs.length === 0 ? (
                <div className="text-muted-foreground">No output yet — run your code to see logs and errors here.</div>
              ) : logs.map((l, i) => (
                <div key={i} className={
                  l.level === "error" ? "text-destructive whitespace-pre-wrap" :
                  l.level === "warn" ? "text-warning whitespace-pre-wrap" :
                  l.level === "info" ? "text-primary whitespace-pre-wrap" :
                  "text-foreground/90 whitespace-pre-wrap"
                }>
                  <span className="text-muted-foreground mr-1">›</span>{l.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
