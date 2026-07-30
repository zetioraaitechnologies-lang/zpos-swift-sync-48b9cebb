import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/zpos-auth";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { ready, user } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (!ready) return;
    if (!user) nav({ to: "/login" });
    else if (user.role === "super_admin") nav({ to: "/admin" });
    else nav({ to: "/dashboard" });
  }, [ready, user, nav]);
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <div className="font-display text-2xl font-bold tracking-widest text-gold">
        ZPOS
      </div>
    </div>
  );
}
