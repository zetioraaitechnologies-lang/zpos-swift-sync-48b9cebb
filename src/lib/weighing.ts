// Support for shops that sell by weight or volume (nusu / robo kilo).
//
// A product is "weighed" when its unit is a mass/volume unit (kg, g, ltr…)
// or when its `sold_by` attribute is set to Weight/Volume.

import type { Product } from "@/lib/zpos-data";

const WEIGHT_UNITS = [
  "kg", "kilo", "kilos", "kilogram", "kilograms", "kgs",
  "g", "gm", "gms", "gram", "grams",
  "l", "lt", "ltr", "litre", "litres", "liter", "liters",
  "ml", "mls",
  "m", "mtr", "meter", "metre", "meters", "metres",
];

export const UNIT_SUGGESTIONS = [
  "pcs", "kg", "gm", "ltr", "ml", "mtr", "box", "carton", "bundle", "dozen",
];

export function isWeighed(p: Pick<Product, "unit" | "attributes">): boolean {
  const soldBy = String((p.attributes ?? {})["sold_by"] ?? "").toLowerCase();
  if (soldBy === "weight" || soldBy === "volume") return true;
  if (soldBy === "piece") return false;
  const u = (p.unit ?? "").trim().toLowerCase();
  return WEIGHT_UNITS.includes(u);
}

/** Smallest sellable increment for this product. */
export function qtyStep(p: Pick<Product, "unit" | "attributes">): number {
  return isWeighed(p) ? 0.25 : 1;
}

/** Quick-pick portions offered at the till for weighed goods. */
export const PORTIONS: { value: number; label: string }[] = [
  { value: 0.25, label: "¼" },
  { value: 0.5, label: "½" },
  { value: 0.75, label: "¾" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 5, label: "5" },
];

export function roundQty(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Human quantity, e.g. "0.5 kg" or "3 pcs". */
export function fmtQty(qty: number, unit?: string | null): string {
  const q = roundQty(qty);
  const text = Number.isInteger(q) ? String(q) : String(q);
  return unit ? `${text} ${unit}` : text;
}
