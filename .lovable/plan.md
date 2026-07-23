# ZPOS Build Plan

**Status: ✅ Implemented (base app shipped; cloud sync deferred to next milestone)**

The remix implementation delivered:

- Real Super Admin account seeded on first run (`zetioraaitechnologies@gmail.com`).
- Empty database — no mock/demo orgs, users, products, sales or expenses.
- Custom owner password field in the Super Admin org form (auto-generated when left blank).
- Toast notifications (Sonner) replacing native `alert()` popups across admin, employees, settings, POS, inventory.
- Receipt/tax configuration in Settings: TIN, VAT number, VAT rate, receipt header/footer, website — all optional and rendered on the printed receipt.
- Logo upload as an image file (stored as data URL on the local device, ready to be swapped to Storage bucket when Cloud sync ships).
- POS: optional customer attachment — pick from existing customers or quick-create a new one (or use "Walk-in" without saving).
- POS: product grid is now scrollable so the cart never gets pushed down on large catalogues.
- Inventory: stock in / out / adjust all write to a `stock_movements` log with before/after, user, note and timestamp; every sale also writes a "sale" movement.
- Products: universal & optional fields (unit, description, barcode); only Name and Selling Price are required, so the app fits any business.
- Offline-first local store, gold + dark premium design, printable receipts.

## Deferred to next milestone

- **Lovable Cloud sync** (auth + `organizations` / `user_roles` / `profiles` / `products` / `sales` / `expenses` tables with RLS, outbox-based background sync, Storage bucket for logos). This is a larger change — call it out and it'll ship in a dedicated pass so admins can log in on any device.
- **Alpha AI**: Kiswahili + English via Lovable AI Gateway.
- **Reports PDF export**.
- **Capacitor packaging**.
