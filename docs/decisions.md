# Technical Decisions

1. **NestJS for the API layer**
   - Modular structure (controllers/services/guards) and a familiar enterprise backend pattern.

2. **Prisma as the data access layer**
   - Type-safe queries, migrations tracked in version control (`prisma/migrations`).

3. **SQLite as the local/demo database**
   - Zero-setup local run (ideal for reviewers). The DB file is ignored; schema + migrations are committed.

4. **JWT-based authentication**
   - Separate USER and ADMIN roles to model real operational workflows.

5. **Ledger model for balances**
   - Balance is derived from ledger entries (DEBIT/CREDIT) instead of storing a mutable “balance” number.
