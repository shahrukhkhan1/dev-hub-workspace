import { Outlet, Link, createRootRoute, HeadContent, Scripts, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import appCss from "../styles.css?url";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Toaster } from "@/components/ui/sonner";
import { registerServiceWorker } from "@/lib/registerSW";
import { HeaderControls } from "@/components/HeaderControls";
import { CommandPalette } from "@/components/CommandPalette";
import "@/lib/sfx";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">This module doesn't exist.</p>
        <Link to="/" className="mt-6 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Go home</Link>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "DevSuite Hub — Developer & Creator Toolkit" },
      { name: "description", content: "Premium client-side image & PDF compression, multi-language code playground, accessibility auditing and quick utilities." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const titles: Record<string, string> = {
  "/": "Dashboard",
  "/image": "Image Studio",
  "/pdf": "PDF Compressor",
  "/code": "Code Playground",
  "/a11y": "Accessibility Auditor",
  "/text": "Text & JSON Studio",
  "/password": "Password & UUID",
  "/qr": "QR Code Studio",
  "/css": "CSS Design Helper",
  "/word-to-html": "Word to HTML",
};

function RootComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => { registerServiceWorker(); }, []);
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b border-border/60 px-4 glass-panel sticky top-0 z-30">
            <SidebarTrigger />
            <div className="h-5 w-px bg-border" />
            <h1 className="text-sm font-semibold tracking-tight">{titles[pathname] ?? "DevSuite Hub"}</h1>
            <div className="ml-auto flex items-center gap-2">
              <HeaderControls onOpenPalette={() => setPaletteOpen(true)} />
            </div>
          </header>
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
        <Toaster position="bottom-right" theme="dark" />
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      </div>
    </SidebarProvider>
  );
}
