import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Users,
  Wallet,
  BarChart3,
  UserCog,
  Sparkles,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/zpos-auth";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/pos", label: "POS", icon: ShoppingCart },
  { to: "/products", label: "Products", icon: Package },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/expenses", label: "Expenses", icon: Wallet },
  { to: "/reports", label: "Reports", icon: BarChart3, ownerOnly: true },
  { to: "/employees", label: "Employees", icon: UserCog, ownerOnly: true },
  { to: "/alpha-ai", label: "Alpha AI", icon: Sparkles },
  { to: "/settings", label: "Settings", icon: Settings, ownerOnly: true },
];

export function AppSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user, org, logout } = useAuth();
  const loc = useRouterState({ select: (s) => s.location.pathname });
  const isOwner = user?.role === "owner";

  const items = NAV.filter((n) => !n.ownerOnly || isOwner);

  return (
    <>
      {open && (
        <button
          aria-label="Close menu"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-navy-deep/60 backdrop-blur-sm lg:hidden"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[color:var(--gold)]/20 bg-card transition-transform lg:translate-x-0 print:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-[color:var(--gold)]/15 px-5 py-5">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center bg-gold-gradient clip-cut-sm">
              <span className="font-display text-lg font-bold text-navy-deep">Z</span>
            </div>
            <div>
              <div className="font-display text-lg font-bold tracking-widest text-gold">
                ZPOS
              </div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {org?.businessName ?? "Zetiora AI"}
              </div>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden text-muted-foreground hover:text-gold"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((n) => {
            const active = loc === n.to;
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                onClick={onClose}
                className={cn(
                  "group flex items-center gap-3 rounded-none px-3 py-2.5 text-sm font-semibold uppercase tracking-wider transition-all",
                  active
                    ? "bg-gold-gradient text-navy-deep shadow-[0_6px_20px_-8px_var(--gold)]"
                    : "text-muted-foreground hover:bg-secondary hover:text-gold",
                )}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[color:var(--gold)]/15 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full border border-[color:var(--gold)]/40 bg-navy-deep/50 font-display text-sm font-bold text-gold">
              {user?.name?.[0] ?? "?"}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{user?.name}</div>
              <div className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
                {user?.role}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-none border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-red-300 hover:bg-red-500/20"
          >
            <LogOut className="h-3.5 w-3.5" /> Logout
          </button>
        </div>
      </aside>
    </>
  );
}

export function MobileMenuButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="grid h-10 w-10 place-items-center rounded-none border border-[color:var(--gold)]/30 bg-input text-gold lg:hidden"
      aria-label="Open menu"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}

export function useSidebar() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}
