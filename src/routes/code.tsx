import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import LZString from "lz-string";
import html2canvas from "html2canvas";
import { Play, Save, Share2, Camera, Plus, FileCode, Trash2, Package, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
    "script.js": `document.getElementById('t').onclick = () => alert('Clicked!');`,
  },
  react: {
    "App.jsx": `function App() {\n  const [n, setN] = React.useState(0);\n  return (\n    <div style={{padding:32,fontFamily:'system-ui'}}>\n      <h1>React Counter</h1>\n      <button onClick={() => setN(n+1)}>Count: {n}</button>\n    </div>\n  );\n}\nReactDOM.createRoot(document.getElementById('root')).render(<App />);`,
  },
  python: {
    "main.py": `import sys\nprint("Hello from Python!")\nfor i in range(5):\n    print(f"i = {i}, squared = {i*i}")`,
  },
};

function buildHtml(runtime: Runtime, files: Record<string,string>, cdns: string[]) {
  const cdnTags = cdns.map(u => u.endsWith(".css") ? `<link rel="stylesheet" href="${u}">` : `<script src="${u}"></script>`).join("\n");
  if (runtime === "html") {
    let html = files["index.html"] || "<!DOCTYPE html><html><body></body></html>";
    const css = files["style.css"] || "";
    const js = files["script.js"] || "";
    html = html.replace("<script src=\"script.js\"></script>", `<script>${js}<\/script>`);
    if (css) html = html.replace("</head>", `<style>${css}<\/style></head>`);
    if (cdnTags) html = html.replace("</head>", `${cdnTags}</head>`);
    if (!html.includes("</head>")) html = html.replace("<body>", `<head>${cdnTags}<style>${css}<\/style></head><body>`);
    return html;
  }
  if (runtime === "react") {
    const code = Object.values(files).join("\n\n");
    return `<!DOCTYPE html><html><head>${cdnTags}
<script src="https://unpkg.com/react@18/umd/react.development.js"><\/script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
</head><body><div id="root"></div>
<script type="text/babel" data-presets="env,react">${code}<\/script>
</body></html>`;
  }
  // python
  const code = files["main.py"] || "";
  const escaped = JSON.stringify(code);
  return `<!DOCTYPE html><html><head>${cdnTags}
<script src="https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js"><\/script>
<style>body{font-family:ui-monospace,monospace;background:#0b1220;color:#e2e8f0;padding:16px;margin:0;white-space:pre-wrap;font-size:13px;}</style>
</head><body id="out">Loading Pyodide...
<script>
(async () => {
  const out = document.getElementById('out');
  out.textContent = 'Loading Python runtime...';
  const py = await loadPyodide();
  out.textContent = '';
  py.setStdout({ batched: (s) => { out.textContent += s + '\\n'; }});
  py.setStderr({ batched: (s) => { out.textContent += '[err] ' + s + '\\n'; }});
  try { await py.runPythonAsync(${escaped}); }
  catch (e) { out.textContent += '\\n' + e; }
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

  // Load shared state from URL hash
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
    setSrcDoc(buildHtml(runtime, files, cdns));
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
            <Button size="sm" variant="outline"><Package className="h-3.5 w-3.5 mr-1" /> CDNs ({cdns.length})</Button>
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
        <div className="bg-white relative min-h-0">
          {srcDoc ? (
            <iframe ref={iframeRef} title="preview" sandbox="allow-scripts allow-modals" srcDoc={srcDoc} className="w-full h-full border-0" />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground bg-card text-sm">Click <span className="font-semibold mx-1">Run</span> to preview</div>
          )}
        </div>
      </div>
    </div>
  );
}
