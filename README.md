# Campus Lost & Found

A small offline DBMS mini-project. Next.js + React + TypeScript provide the interface and server actions. MySQL stores application records, Redis stores login sessions, and embedded PostgreSQL with pgvector ranks similar items.

## Run on this Windows computer

This copy is prepared for the installed MySQL Server. Double-click **Start Demo.cmd**, then open **http://127.0.0.1:3000**. Keep the console open. No internet or Docker is required for normal use.

| College ID | Role             | Password   |
| ---------- | ---------------- | ---------- |
| SEC001     | Security / Admin | Campus123! |
| STU001     | Regular user     | Campus123! |
| STU002     | Regular user     | Campus123! |

These are fictional demo accounts. Passwords in MySQL are salted scrypt hashes.

If this is a freshly extracted source copy, run **Prepare Demo.cmd** once while online. It installs packages if needed, downloads a checksum-verified portable Redis Windows build if missing, initializes an isolated MySQL instance, seeds records and builds Next.js. MySQL Server must already be installed. Set `MYSQL_BIN` to its bin folder if it is not under `C:\Program Files\MySQL`.

After a demo, stop the website with Ctrl+C, then double-click **Stop Databases.cmd**. Database files and photos remain on disk. Restarting does not reset collections or accounts.

## Scope

- Admin creates college-ID/password accounts; no public signup or email.
- Users submit found items with photos and identifying descriptions.
- Security physically receives an item before making it available.
- Everyone signed in can browse available and collected items.
- Only security can record an in-person, college-ID-verified collection.
- Claimant need not have a login account.
- Regular users cannot view claimant or finder identities.
- Similar items uses a local word/attribute vector; no AI API or photo recognition.

## Three database technologies

| Store                 | Data                                                     | Implementation                                           |
| --------------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| MySQL 8               | Users, categories, items, collections                    | Native isolated server on port 13306                     |
| Redis                 | Expiring login sessions and brief login-attempt counters | Portable native Windows build on port 16379              |
| PostgreSQL + pgvector | 128-dimensional item vectors                             | PGlite runs real PostgreSQL/pgvector in the Node process |

**Redis is the NoSQL database. PostgreSQL/pgvector is not NoSQL.** If the assessment requires an additional NoSQL store separate from Redis, this stack does not satisfy that additional interpretation. Do not describe pgvector as NoSQL during the viva.

PGlite is an embedded PostgreSQL runtime, not a TCP PostgreSQL server: pgAdmin cannot connect to it. `npm run db:check` prints its real PostgreSQL and extension versions. The SQL is in `database/vector.sql`; executing application queries is in `src/lib/vectors.ts`. Stop the website before running scripts that open vector storage; use one Node website process at a time.

For Windows we use the community [Redis for Windows build](https://github.com/redis-windows/redis-windows), compiled from Redis source. It is used only on localhost for this classroom demo, not installed as a Windows service. The pinned release and SHA-256 are recorded in `scripts/prepare-local.ts`.

## Code map

```text
src/app/                    Next.js pages (React server components)
  actions.ts                Form submissions, validation and authorization
  login/                    College ID/password login
  items/                    Public-to-signed-in item list and details
  submit/                   Found-item form
  manage/                   Security receipt and collection
  accounts/                 Account creation (admin only)
  media/[name]/route.ts     Authenticated local photo delivery
src/components/             Header, cards, notices, submit button
src/lib/
  db.ts                     MySQL pool and parameterized query helpers
  auth.ts                   Redis sessions and role guards
  password.ts               Salted password hashing
  validation.ts             Form and upload validation
  items.ts                  SQL SELECT queries
  vectors.ts                Local vectors and PostgreSQL similarity queries
database/mysql.sql          Tables, public view, trigger, stored procedure
database/seed.json          Fictional demo item data
database/demo-queries.sql   Read-only SQL examples for the viva
scripts/                    Setup, checks, local service management
tests/                      Focused password/vector/validation checks
assets/photos/              Bundled sample photos (offline)
storage/                    Generated uploads and PostgreSQL files (ignored)
.local/                     Private MySQL/Redis files and logs (ignored)
```

## Why the backend is simple

React forms call functions in `src/app/actions.ts` directly through Next.js server actions. Those functions validate input, check the logged-in user's role, and execute parameterized SQL. There is no separate Express application or ORM. MySQL is authoritative: a vector indexing failure does not discard an item. Rerun `npm run db:setup` with the website stopped to rebuild vectors; existing users/items/collections are preserved.

Photos are on disk and their filenames are in MySQL. Uploads accept JPG/PNG/WebP signatures up to 5 MB, use generated filenames, and are served only after login. The demo uses local assets and system fonts. There are no CDN, AI, email, analytics or map dependencies.

## Development and checks

```powershell
npm run demo:services
npm run db:setup
npm test
npm run test:integration
npm run typecheck
npm run build
npm start
```

Run the vector-opening scripts (`db:setup`, `db:check`, `test:integration`) with the website stopped. Integration tests create and remove their own temporary records; they do not reset your demo data. `npm run dev` is available for editing instead of `npm start`.

## Existing database services / other computers

You may use your own MySQL and Redis rather than the local convenience scripts:

1. Install Node.js (20.9+; Node 22 recommended), MySQL 8, and Redis.
2. Run `npm ci` once online.
3. Create an empty `campus_lost_found` MySQL database and an application user allowed to create its tables, view, trigger and routine. If binary logging is enabled, have the DBA install the trigger/routine or configure the appropriate trust setting; the isolated demo instance avoids this by disabling binary logging.
4. Copy `.env.example` to `.env` and set database credentials. No PostgreSQL installation is needed because PGlite includes PostgreSQL and pgvector.
5. Start your database services, then run `npm run db:setup`, `npm run build`, and `npm start`.

The `.cmd` service launchers are for the private Windows setup; use your own service commands with manual databases. Keep `.env`, `.local`, `storage`, and `node_modules` out of the submitted source archive. Never delete `.local` or `storage` to fix a startup problem: they contain your actual demo data.

## Troubleshooting

- **Port 3000 is busy:** stop the previous website terminal; run only one copy.
- **Database unavailable:** run `npm run demo:services`; inspect `.local/mysql.log` and `.local/redis.log`.
- **No items:** stop the website and run `npm run db:setup`.
- **Cannot sign in:** IDs are case-insensitive in the form; demo password is `Campus123!`. Use the exact same `127.0.0.1` URL consistently rather than switching between localhost and 127.0.0.1.
- **Similar items unavailable:** stop the website, run `npm run db:setup`, restart.
- **Build missing:** run `npm run build` once before the offline demo.
- **Moved the entire project folder:** with the website and private services stopped, rerun `npm run demo:prepare` to refresh absolute runtime paths, then `npm run build`.

See **DEMO-GUIDE.md** for the walkthrough and explanations.
