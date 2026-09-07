import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Users,
  Truck,
  HandCoins,
  Wallet,
  BarChart3,
  UserCog,
  Sparkles,
  Settings,
  LogOut,
  Menu,
  X,
  ReceiptText,
  ClipboardList,
  ArrowLeftRight,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/zpos-auth";
import { canOpen } from "@/lib/staff-roles";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/pos", label: "POS", icon: ShoppingCart },
  { to: "/receipts", label: "Receipts", icon: ReceiptText },
  { to: "/products", label: "Products", icon: Package },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/handovers", label: "Handovers", icon: ClipboardList },
  { to: "/transfers", label: "Transfers", icon: ArrowLeftRight },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/purchases", label: "Purchases", icon: Truck },
  { to: "/debts", label: "Debts", icon: HandCoins },
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

  const items = NAV.filter(
    (n) =>
      (!n.ownerOnly || isOwner) &&
      canOpen(n.to, user?.role ?? "cashier", user?.jobRole),
  );


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
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-navy text-primary-foreground transition-transform lg:translate-x-0 print:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center bg-gold-gradient clip-cut-sm">
              <span className="font-display text-lg font-bold text-on-accent">Z</span>
            </div>
            <div>
              <div className="font-display text-lg font-bold tracking-[0.22em]">
                ZPOS
              </div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-white/55">
                {org?.businessName ?? "Zetiora AI"}
              </div>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden text-white/60 hover:text-gold"
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
                  "group flex items-center gap-3 clip-cut-sm px-3 py-2.5 font-display text-xs font-semibold uppercase tracking-[0.16em] transition-all",
                  active
                    ? "bg-gold-gradient text-on-accent"
                    : "text-white/65 hover:bg-white/10 hover:text-gold",
                )}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center clip-cut-sm border border-gold/50 font-display text-sm font-bold text-gold">
              {user?.name?.[0] ?? "?"}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{user?.name}</div>
              <div className="truncate text-[10px] uppercase tracking-[0.2em] text-white/50">
                {user?.role}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 clip-cut-sm border border-white/20 px-3 py-2 font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70 hover:border-red-400/60 hover:text-red-300"
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
