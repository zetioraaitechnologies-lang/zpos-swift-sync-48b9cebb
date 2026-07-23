import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/zpos-auth";
import { AppSidebar, MobileMenuButton, useSidebar } from "@/components/zpos/app-sidebar";
import { ConnectivityBadge } from "@/components/zpos/connectivity";
import { AlphaFab } from "@/components/zpos/alpha-fab";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { ready, user } = useAuth();
  const nav = useNavigate();
  const { open, setOpen } = useSidebar();

  useEffect(() => {
    if (!ready) return;
    if (!user) nav({ to: "/login" });
    else if (user.role === "super_admin") nav({ to: "/admin" });
  }, [ready, user, nav]);

  if (!ready || !user || user.role === "super_admin") {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="font-display text-gold">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppSidebar open={open} onClose={() => setOpen(false)} />
      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[color:var(--gold)]/15 bg-card/95 px-4 py-3 backdrop-blur-lg print:hidden">
          <MobileMenuButton onOpen={() => setOpen(true)} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-sm font-bold uppercase tracking-widest text-gold">
              {user.name}
            </div>
            <div className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
              {user.role} · ZPOS
            </div>
          </div>
          <ConnectivityBadge />
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
      <AlphaFab />
    </div>
  );
}
