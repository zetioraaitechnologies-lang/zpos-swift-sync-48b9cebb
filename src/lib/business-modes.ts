// Business-mode registry.
//
// One org = one business type, chosen by the super-admin at creation time.
// The mode drives three things:
//   1. Extra product fields (stored in products.attributes jsonb)
//   2. UI wording (what an "item" is called, category suggestions)
//   3. Accent theme colour
//
// Adding a new vertical = adding one entry here. No schema change needed.

export type FieldType = "text" | "number" | "date" | "select";

export interface ModeField {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: string[];
  /** Show this field as a column in the products table. */
  column?: boolean;
}

export interface BusinessMode {
  id: string;
  label: string;
  tagline: string;
  /** Accent overrides — these replace the --gold* tokens for this org. */
  accent: { base: string; bright: string; deep: string };
  /** Wording */
  itemSingular: string;
  itemPlural: string;
  /** Suggested product categories for this vertical. */
  categories: string[];
  /** Extra product attributes. */
  fields: ModeField[];
  /** Warn when a dated field is close/past (key of a date field). */
  expiryField?: string;
}

const AZURE = { base: "oklch(0.55 0.16 250)", bright: "oklch(0.65 0.15 240)", deep: "oklch(0.44 0.15 258)" };

export const BUSINESS_MODES: BusinessMode[] = [
  {
    id: "general",
    label: "General Shop",
    tagline: "Everyday retail — works for any goods",
    accent: AZURE,
    itemSingular: "Product",
    itemPlural: "Products",
    categories: ["General", "Drinks", "Food", "Household", "Stationery"],
    fields: [],
  },
  {
    id: "pharmacy",
    label: "Pharmacy",
    tagline: "Batches, expiry dates and prescriptions",
    accent: { base: "oklch(0.6 0.14 165)", bright: "oklch(0.7 0.13 160)", deep: "oklch(0.48 0.13 168)" },
    itemSingular: "Medicine",
    itemPlural: "Medicines",
    categories: ["Tablets", "Syrups", "Injectables", "Antibiotics", "Supplements", "Equipment"],
    fields: [
      { key: "generic_name", label: "Generic Name", type: "text", placeholder: "e.g. Paracetamol" },
      { key: "strength", label: "Strength / Dosage", type: "text", placeholder: "500mg" },
      { key: "batch_no", label: "Batch No.", type: "text", column: true },
      { key: "expiry_date", label: "Expiry Date", type: "date", column: true },
      { key: "prescription", label: "Prescription", type: "select", options: ["Not required", "Required"] },
      { key: "manufacturer", label: "Manufacturer", type: "text" },
    ],
    expiryField: "expiry_date",
  },
  {
    id: "hardware",
    label: "Hardware Store",
    tagline: "Bulk units, brands and warranties",
    accent: { base: "oklch(0.62 0.15 60)", bright: "oklch(0.72 0.14 70)", deep: "oklch(0.5 0.14 55)" },
    itemSingular: "Item",
    itemPlural: "Items",
    categories: ["Cement & Building", "Plumbing", "Electrical", "Tools", "Paint", "Fasteners"],
    fields: [
      { key: "brand", label: "Brand", type: "text", column: true },
      { key: "bulk_unit", label: "Bulk Unit", type: "text", placeholder: "carton, bundle, roll" },
      { key: "bulk_qty", label: "Pieces per Bulk Unit", type: "number" },
      { key: "bulk_price", label: "Bulk Price", type: "number" },
      { key: "warranty_months", label: "Warranty (months)", type: "number" },
    ],
  },
  {
    id: "clothing",
    label: "Clothing / Boutique",
    tagline: "Sizes, colours and seasons",
    accent: { base: "oklch(0.58 0.18 330)", bright: "oklch(0.68 0.17 336)", deep: "oklch(0.46 0.17 326)" },
    itemSingular: "Garment",
    itemPlural: "Garments",
    categories: ["Men", "Women", "Kids", "Shoes", "Accessories"],
    fields: [
      { key: "size", label: "Size", type: "text", placeholder: "S, M, L, 42…", column: true },
      { key: "color", label: "Colour", type: "text", column: true },
      { key: "material", label: "Material", type: "text" },
      { key: "gender", label: "Gender", type: "select", options: ["Unisex", "Men", "Women", "Kids"] },
      { key: "season", label: "Season / Collection", type: "text" },
    ],
  },
  {
    id: "electronics",
    label: "Electronics",
    tagline: "Serial numbers, models and warranty",
    accent: { base: "oklch(0.6 0.16 285)", bright: "oklch(0.7 0.15 290)", deep: "oklch(0.47 0.16 282)" },
    itemSingular: "Device",
    itemPlural: "Devices",
    categories: ["Phones", "Computers", "Audio", "TV & Display", "Accessories"],
    fields: [
      { key: "brand", label: "Brand", type: "text", column: true },
      { key: "model", label: "Model", type: "text", column: true },
      { key: "serial", label: "Serial / IMEI", type: "text" },
      { key: "warranty_months", label: "Warranty (months)", type: "number" },
    ],
  },
  {
    id: "grocery",
    label: "Grocery / Mini-Market",
    tagline: "Weighed goods and short shelf life",
    accent: { base: "oklch(0.62 0.15 140)", bright: "oklch(0.72 0.14 143)", deep: "oklch(0.5 0.14 136)" },
    itemSingular: "Product",
    itemPlural: "Products",
    categories: ["Cereals", "Fresh Produce", "Dairy", "Frozen", "Beverages", "Cleaning"],
    fields: [
      { key: "sold_by", label: "Sold By", type: "select", options: ["Piece", "Weight", "Volume"] },
      { key: "expiry_date", label: "Best Before", type: "date", column: true },
      { key: "origin", label: "Origin / Supplier", type: "text" },
    ],
    expiryField: "expiry_date",
  },
  {
    id: "restaurant",
    label: "Restaurant / Bar",
    tagline: "Menu items, portions and preparation",
    accent: { base: "oklch(0.6 0.17 30)", bright: "oklch(0.7 0.16 38)", deep: "oklch(0.48 0.16 26)" },
    itemSingular: "Menu Item",
    itemPlural: "Menu",
    categories: ["Starters", "Main Course", "Grill", "Soft Drinks", "Beers & Spirits", "Desserts"],
    fields: [
      { key: "portion", label: "Portion", type: "text", placeholder: "Full, Half, 500ml" },
      { key: "prep_minutes", label: "Prep Time (min)", type: "number" },
      { key: "station", label: "Kitchen Station", type: "select", options: ["Kitchen", "Grill", "Bar", "Counter"] },
    ],
  },
  {
    id: "services",
    label: "Services",
    tagline: "Salon, garage, workshop and repairs",
    accent: { base: "oklch(0.58 0.13 210)", bright: "oklch(0.68 0.12 205)", deep: "oklch(0.46 0.13 215)" },
    itemSingular: "Service",
    itemPlural: "Services",
    categories: ["Repairs", "Maintenance", "Consultation", "Beauty", "Installation"],
    fields: [
      { key: "duration_minutes", label: "Duration (min)", type: "number" },
      { key: "performed_by", label: "Performed By", type: "text", column: true },
      { key: "warranty_days", label: "Service Warranty (days)", type: "number" },
    ],
  },
];

export const DEFAULT_MODE = BUSINESS_MODES[0]!;

export function getMode(id?: string | null): BusinessMode {
  return BUSINESS_MODES.find((m) => m.id === id) ?? DEFAULT_MODE;
}

/** CSS variable overrides to apply on a container for this mode. */
export function modeStyle(mode: BusinessMode): React.CSSProperties {
  return {
    ["--gold" as string]: mode.accent.base,
    ["--gold-bright" as string]: mode.accent.bright,
    ["--gold-deep" as string]: mode.accent.deep,
    ["--gradient-gold" as string]: `linear-gradient(135deg, ${mode.accent.bright}, ${mode.accent.deep})`,
    ["--ring" as string]: mode.accent.base,
  } as React.CSSProperties;
}

export type ProductAttributes = Record<string, string | number | null>;

/** Days until an expiry-style attribute, or null when not applicable. */
export function daysUntil(value: unknown): number | null {
  if (!value || typeof value !== "string") return null;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
}
