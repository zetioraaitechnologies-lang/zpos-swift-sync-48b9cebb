// Staff job roles and what each of them may open.
//
// Access level in the database stays simple (owner | cashier) so multi-store
// row-level security keeps working; the job role below decides which screens a
// staff member actually sees. Owners always see everything for the store they
// are currently switched into — staff never see other stores at all, because
// every query is scoped to the active org id.

export const STAFF_ROLES = [
  "Manager",
  "Cashier",
  "Waiter",
  "Storekeeper",
  "Accountant",
  "Chef",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export const ALL_PATHS = [
  "/dashboard",
  "/pos",
  "/receipts",
  "/products",
  "/inventory",
  "/handovers",
  "/transfers",
  "/customers",
  "/purchases",
  "/debts",
  "/expenses",
  "/reports",
  "/employees",
  "/alpha-ai",
  "/settings",
] as const;

const PERMS: Record<StaffRole, string[]> = {
  Manager: [
    "/dashboard",
    "/pos",
    "/receipts",
    "/products",
    "/inventory",
    "/handovers",
    "/transfers",
    "/customers",
    "/purchases",
    "/debts",
    "/expenses",
    "/reports",
    "/alpha-ai",
  ],
  Cashier: ["/dashboard", "/pos", "/receipts", "/customers", "/debts", "/alpha-ai"],
  Waiter: ["/pos", "/receipts", "/handovers", "/customers"],
  Storekeeper: [
    "/products",
    "/inventory",
    "/handovers",
    "/transfers",
    "/purchases",
    "/dashboard",
  ],
  Accountant: [
    "/dashboard",
    "/receipts",
    "/reports",
    "/expenses",
    "/debts",
    "/purchases",
  ],
  Chef: ["/handovers", "/inventory", "/products"],
};

export function normalizeRole(label?: string | null): StaffRole {
  const found = STAFF_ROLES.find(
    (r) => r.toLowerCase() === (label ?? "").trim().toLowerCase(),
  );
  return found ?? "Cashier";
}

/** Paths this person may open. Owners get everything. */
export function allowedPaths(
  accessRole: "owner" | "cashier" | "super_admin",
  jobRole?: string | null,
): string[] {
  if (accessRole === "owner") return [...ALL_PATHS];
  return PERMS[normalizeRole(jobRole)];
}

export function canOpen(
  path: string,
  accessRole: "owner" | "cashier" | "super_admin",
  jobRole?: string | null,
): boolean {
  return allowedPaths(accessRole, jobRole).some((p) => path.startsWith(p));
}
