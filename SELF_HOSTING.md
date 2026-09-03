# ZPoS — Kujiendesha na Supabase Yako Mwenyewe (Self-Hosting)

Mwongozo huu unakuwezesha kuendesha ZPoS kwenye **Supabase project yako** na
**Vercel**, bila kutegemea Lovable zaidi ya kuandika code.

---

## 1. Tengeneza Supabase project

1. Nenda https://supabase.com/dashboard → **New project**.
2. Weka jina (mf. `zpos-prod`), password ya database, chagua region (mf. `eu-central-1`).
3. Subiri hadi iwe *Active*.

## 2. Endesha SQL (database tupu, bila data)

Fungua **SQL Editor** kwenye project yako, kisha endesha faili hizi kwa mpangilio:

| Nambari | Faili | Kazi |
| --- | --- | --- |
| 1 | `sql/01_zpos_full_schema.sql` | Tables zote, enums, RLS policies, GRANTs, functions (`record_sale`, `record_purchase`, `has_role`, n.k.), triggers, indexes. **Haina data yoyote.** |
| 2 | `sql/02_bootstrap_super_admin.sql` | Mtumiaji **wa kwanza** kwenye Auth anakuwa `super_admin` kiotomatiki + helper `promote_super_admin('email')`. |
| 3 | `sql/03_employees_roles_unique_constraints.sql` | Unique constraints kamili za `employees` na `user_roles` (huondoa error ya *"no unique or exclusion constraint matching the ON CONFLICT specification"* wakati wa kuongeza cashier/employee). |
| (hiari) | `sql/99_reset_data.sql` | Kufuta data zote baadaye ukitaka kuanza upya (schema inabaki). |

> Kila mabadiliko mapya ya database yataandikwa kama faili jipya kwenye folder `sql/`
> (mf. `sql/03_....sql`) ili uendeshe mwenyewe.

## 3. Tengeneza System Admin (wewe)

**Njia A — mtumiaji wa kwanza (rahisi):**
1. Supabase → **Authentication → Users → Add user**.
2. Weka email + password, washa **Auto Confirm User**.
3. Kwa kuwa ndiye wa kwanza, trigger inampa `super_admin` moja kwa moja.

**Njia B — kama tayari kuna watumiaji:** baada ya kuunda user, endesha:

```sql
SELECT public.promote_super_admin('email-yako@example.com');
```

Thibitisha:

```sql
SELECT u.email, r.role FROM public.user_roles r JOIN auth.users u ON u.id = r.user_id;
```

## 4. Zima ujiandikishaji wa umma (closed system)

Supabase → **Authentication → Sign In / Providers**:
- **Email**: iwe *enabled*, lakini **Allow new users to sign up = OFF**.
- **Confirm email**: OFF (akaunti zinaundwa na admin tayari zimethibitishwa).
- Usiwashe Anonymous sign-ins.

## 5. Chukua keys

Supabase → **Project Settings → API**:
- `Project URL`
- `anon` / `publishable` key
- `service_role` key (**siri kabisa** — server only)

## 6. Weka environment variables (Vercel & local)

Vercel → **Settings → Environment Variables** (Production **na** Preview):

| Jina | Thamani |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | anon/publishable key |
| `VITE_SUPABASE_PROJECT_ID` | project ref (mf. `abcd1234`) |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
| `SUPER_ADMIN_EMAILS` | email(s) za admin, zikitenganishwa kwa koma |
| `VITE_SUPER_ADMIN_EMAILS` | email(s) zile zile (upande wa browser) |

Kwa local (`.env.local`) weka hizo hizo. Ukiwa unaendesha ndani ya Lovable,
`.env` ya Lovable inabaki kama ilivyo — hii ni kwa deployment yako.

> Ndiyo sababu ya kosa la awali: Vercel haikuwa na `SUPABASE_SERVICE_ROLE_KEY`
> (key ya Lovable haitolewi). Sasa unatumia project yako, kwa hiyo key ipo mikononi mwako.

## 7. Deploy Vercel

1. https://vercel.com/new → chagua repo yako ya GitHub.
2. Build Command: `npm run build` (au `bun run build`), Output: acha wazi (Nitro preset `vercel`).
3. Weka env vars za hapo juu → **Deploy**.
4. Baada ya deploy, fungua URL → **Login** kwa email/password ya admin uliyounda.

## 8. Mtiririko wa matumizi (flow)

1. **Super admin** ana-login → ukurasa `/admin`.
2. Ana-create **Organization + Owner** (email + password ya owner). Anaweza
   pia kuongeza duka la pili kwa owner yule yule (multi-store).
3. **Owner** ana-login → anaongeza products, customers, suppliers, employees;
   anaweza ku-invite **cashier**.
4. Mauzo yanapitia `record_sale` (stock, faida, madeni yanahesabiwa server-side).
5. Data zote zina **RLS kwa org** — duka moja haliwezi kuona la lingine.
6. Ukiwa **offline**, kazi zinawekwa kwenye foleni ya ndani (localStorage) na
   zinasukumwa zenyewe mtandao ukirudi; PWA/service worker inashikilia UI.

## 9. App ya simu (Capacitor)

Angalia `CAPACITOR.md` — hatua za `npx cap add android`, build ya APK n.k.
Weka `server.url` ya Capacitor ielekee URL yako ya Vercel.

## 10. Ukikwama

| Tatizo | Sababu / Suluhisho |
| --- | --- |
| "server is missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" | Env vars hazijawekwa Vercel (au haukufanya redeploy baada ya kuziweka). |
| "This account is not assigned to any organization" | User hana row kwenye `user_roles`. Tumia `/admin` au `promote_super_admin`. |
| "permission denied for table ..." | Hukuendesha `01_zpos_full_schema.sql` yote (GRANTs zipo humo). |
| Login inakataa akaunti mpya | Sign-ups zimezimwa kwa makusudi — akaunti zinaundwa na admin. |
