# SQL ya ZPoS

Endesha faili hizi kwenye **Supabase → SQL Editor** kwa mpangilio wa namba.

| Faili | Kazi | Lini |
| --- | --- | --- |
| `01_zpos_full_schema.sql` | Schema kamili: enums, tables, GRANTs, RLS policies, functions, triggers, indexes. Haina data. | Mara moja, project mpya |
| `02_bootstrap_super_admin.sql` | Mtumiaji wa kwanza wa Auth = `super_admin`; helper `promote_super_admin('email')` | Baada ya 01 |
| `03_employees_roles_unique_constraints.sql` | Unique constraints kamili za `employees` na `user_roles` (inaondoa error ya "no unique or exclusion constraint matching the ON CONFLICT specification") | Baada ya 02 |
| `99_reset_data.sql` | Kufuta data zote (schema inabaki) | Ukitaka kuanza upya |

Mabadiliko yote mapya ya database yataongezwa hapa kama `03_...`, `04_...` n.k.
Maelekezo kamili ya deployment: angalia `SELF_HOSTING.md`.
