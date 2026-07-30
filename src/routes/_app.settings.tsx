import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Upload, Image as ImageIcon } from "lucide-react";
import { updateOrgSettings } from "@/lib/zpos-data";
import { useAuth } from "@/lib/zpos-auth";
import { GoldButton } from "@/components/zpos/gold-button";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  component: Settings,
});

function Settings() {
  const { org, user, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
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
    if (!file.type.startsWith("image/")) return toast.error("Please pick an image file");
    if (file.size > 2 * 1024 * 1024) return toast.error("Logo must be smaller than 2MB");
    const reader = new FileReader();
    reader.onload = () => setF((s) => ({ ...s, logo: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const rate = f.vatRate.trim() === "" ? undefined : Number(f.vatRate);
    if (rate !== undefined && (Number.isNaN(rate) || rate < 0)) {
      return toast.error("VAT rate must be a positive number");
    }
    setBusy(true);
    try {
      await updateOrgSettings(org.id, {
        businessName: f.businessName,
        phone: f.phone,
        address: f.address,
        currency: f.currency || "TZS",
        receiptHeader: f.receiptHeader || undefined,
        receiptFooter: f.receiptFooter || undefined,
        logo: f.logo || undefined,
        tin: f.tin || undefined,
        vatNumber: f.vatNumber || undefined,
        vatRate: rate,
        website: f.website || undefined,
      });
      await refresh();
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold uppercase tracking-wider">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Business details, receipt info & branding — synced across every device
        </p>
      </div>

      <form onSubmit={save} className="panel clip-cut-card space-y-6 p-6">
        <div>
          <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Business Logo
          </span>
          <div className="flex items-center gap-4">
            <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-none border border-border bg-input">
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
                className="inline-flex items-center gap-2 rounded-none border border-border px-3 py-2 text-xs font-semibold uppercase tracking-widest hover:bg-secondary"
              >
                <Upload className="h-3.5 w-3.5" /> Upload image
              </button>
              {f.logo && (
                <button
                  type="button"
                  onClick={() => setF({ ...f, logo: "" })}
                  className="rounded-none border border-red-500/30 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-red-300 hover:bg-red-500/10"
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
            PNG or JPG, up to 2MB. Stored with your business.
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

        <GoldButton type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</GoldButton>
        <style>{`.input{width:100%;border-radius:0.375rem;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.4);padding:0.5rem 0.75rem;font-size:0.875rem;outline:none}.input:focus{border-color:color-mix(in oklab,var(--gold) 60%,transparent)}`}</style>
      </form>

      <div className="panel clip-cut-card p-5 text-xs text-muted-foreground">
        <div className="mb-1 font-display text-sm font-bold uppercase tracking-widest text-gold">
          Sync status
        </div>
        Every change here — and everywhere else in ZPOS — writes directly to the cloud
        and appears on every signed-in device for {org.businessName} within seconds.
        There is nothing to back up manually.
      </div>
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
