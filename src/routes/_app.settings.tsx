import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Upload, Image as ImageIcon } from "lucide-react";
import { zdb } from "@/lib/zpos-db";
import { useAuth } from "@/lib/zpos-auth";
import { GoldButton } from "@/components/zpos/gold-button";
import { toast } from "sonner";
import { CloudSyncPanel } from "@/components/zpos/cloud-sync-panel";

export const Route = createFileRoute("/_app/settings")({
  component: Settings,
});

function Settings() {
  const { org, user } = useAuth();
  const [, setV] = useState(0);
  useEffect(() => {
    const u = zdb.subscribe(() => setV((n) => n + 1));
    return () => { u(); };
  }, []);
  const [f, setF] = useState(() => ({
    businessName: org?.businessName ?? "",
    phone: org?.phone ?? "",
    address: org?.address ?? "",
    currency: org?.currency ?? "TZS",
    receiptHeader: org?.receiptHeader ?? "",
    receiptFooter: org?.receiptFooter ?? "",
    logo: org?.logo ?? "",
    tin: org?.tin ?? "",
    vatNumber: org?.vatNumber ?? "",
    vatRate: org?.vatRate?.toString() ?? "",
    website: org?.website ?? "",
  }));
  const fileRef = useRef<HTMLInputElement>(null);

  if (!org || user?.role !== "owner") {
    return (
      <div className="panel clip-cut-card p-8 text-center text-muted-foreground">
        Only the Owner can edit settings.
      </div>
    );
  }

  const onPickLogo = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please pick an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be smaller than 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setF((s) => ({ ...s, logo: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const rate = f.vatRate.trim() === "" ? undefined : Number(f.vatRate);
    if (rate !== undefined && (Number.isNaN(rate) || rate < 0)) {
      toast.error("VAT rate must be a positive number");
      return;
    }
    zdb.update((d) => {
      const o = d.orgs.find((x) => x.id === org.id);
      if (o) {
        o.businessName = f.businessName;
        o.phone = f.phone;
        o.address = f.address;
        o.currency = f.currency || "TZS";
        o.receiptHeader = f.receiptHeader || undefined;
        o.receiptFooter = f.receiptFooter || undefined;
        o.logo = f.logo || undefined;
        o.tin = f.tin || undefined;
        o.vatNumber = f.vatNumber || undefined;
        o.vatRate = rate;
        o.website = f.website || undefined;
      }
    });
    toast.success("Settings saved");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-black uppercase tracking-wider">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Business details, receipt info & branding — every field is optional
        </p>
      </div>

      <form onSubmit={save} className="panel clip-cut-card space-y-6 p-6">
        {/* Logo */}
        <div>
          <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Business Logo
          </span>
          <div className="flex items-center gap-4">
            <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-md border border-white/10 bg-black/40">
              {f.logo ? (
                <img src={f.logo} alt="logo" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-widest hover:bg-white/5"
              >
                <Upload className="h-3.5 w-3.5" /> Upload image
              </button>
              {f.logo && (
                <button
                  type="button"
                  onClick={() => setF({ ...f, logo: "" })}
                  className="rounded-md border border-red-500/30 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-red-300 hover:bg-red-500/10"
                >
                  Remove
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => e.target.files?.[0] && onPickLogo(e.target.files[0])}
              />
            </div>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            PNG or JPG, up to 2MB. Stored securely with your business data.
          </p>
        </div>

        <Section title="Business">
          <Field label="Business Name">
            <input value={f.businessName} onChange={(e) => setF({ ...f, businessName: e.target.value })} className="input" />
          </Field>
          <Field label="Phone">
            <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className="input" />
          </Field>
          <Field label="Address" full>
            <input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} className="input" />
          </Field>
          <Field label="Website">
            <input value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} className="input" placeholder="https://…" />
          </Field>
          <Field label="Currency">
            <input value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} className="input" placeholder="TZS" />
          </Field>
        </Section>

        <Section title="Tax & Receipt (optional)">
          <Field label="TIN Number">
            <input value={f.tin} onChange={(e) => setF({ ...f, tin: e.target.value })} className="input" />
          </Field>
          <Field label="VAT Reg. Number">
            <input value={f.vatNumber} onChange={(e) => setF({ ...f, vatNumber: e.target.value })} className="input" />
          </Field>
          <Field label="VAT Rate (%)">
            <input value={f.vatRate} onChange={(e) => setF({ ...f, vatRate: e.target.value })} className="input" inputMode="decimal" placeholder="e.g. 18" />
          </Field>
          <Field label="Receipt Header" full>
            <input value={f.receiptHeader} onChange={(e) => setF({ ...f, receiptHeader: e.target.value })} className="input" placeholder="e.g. TAX INVOICE" />
          </Field>
          <Field label="Receipt Footer" full>
            <input value={f.receiptFooter} onChange={(e) => setF({ ...f, receiptFooter: e.target.value })} className="input" placeholder="Thank you for your business!" />
          </Field>
        </Section>

        <GoldButton type="submit">Save changes</GoldButton>
        <style>{`.input{width:100%;border-radius:0.375rem;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.4);padding:0.5rem 0.75rem;font-size:0.875rem;outline:none}.input:focus{border-color:color-mix(in oklab,var(--gold) 60%,transparent)}`}</style>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-widest text-gold">
        {title}
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={full ? "sm:col-span-2 block" : "block"}>
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
