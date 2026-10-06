# Konek Barangay

Resident profiling, online document requests, staff processing, certificate generation, and public QR verification built with Next.js App Router, TypeScript, Tailwind CSS, Prisma, PostgreSQL, and an S3-compatible private bucket.

## Requirements

- Node.js 20.9 or newer
- PostgreSQL 14+ (Supabase is supported)
- A private S3-compatible bucket with server-side encryption enabled
- HTTPS public URL for production certificate verification

## Configure and run locally

1. Copy `.env.example` to `.env` and configure both PostgreSQL URLs, two independent application secrets, the public app URL, and S3 credentials. Generate a 32-byte AES key with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and a session secret with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`. Keep the encryption key and its backups in a managed secret store.
2. Using a trusted database administrator connection, create the non-owner runtime role and set its password without placing the password in source control:

   ```sql
   CREATE ROLE konek_app LOGIN;
   GRANT CONNECT ON DATABASE postgres TO konek_app;
   ```

   For `psql`, set the role password interactively with `\password konek_app`. Set `DATABASE_URL` to this account and `DIRECT_URL` to the separate migration-owner connection. The runtime role must not own the schema and must not have `BYPASSRLS`.
3. Install dependencies with `npm install`.
4. Apply the versioned schema and RLS migrations using the PostgreSQL **direct** connection:

   ```powershell
   npm run db:migrate
   ```

5. Set `ADMIN_EMAIL` and a unique `ADMIN_INITIAL_PASSWORD` of at least 16 characters. Bootstrap the first administrator once:

   ```powershell
   npm run db:seed
   ```

   Remove the bootstrap password from the environment after setup. The seed will not reset an existing account.
6. Run `npm run dev` and open `http://localhost:3000`.

Configure the bucket's CORS policy to allow only the deployed application origins to `PUT` the supported PNG/JPEG/PDF/WebP content types. Keep the bucket private; the application generates short-lived signed URLs for each file.

`DIRECT_URL` is used for schema migrations and must have permission to create tables, functions, policies, and grant privileges. Before migration, provision a `konek_app` database role with a strong secret; the RLS migration grants that role runtime table access. Set `DATABASE_URL` to this role through the runtime pooler. It must **not own tables and must not have `BYPASSRLS`**; otherwise PostgreSQL intentionally bypasses row policies. Supabase service-role credentials bypass RLS and must not be used as the runtime database role. The RLS migration uses transaction-local `app.current_user_id` / `app.current_user_role` values, set by `withRlsContext` for protected resident data. Public QR lookups use a restricted `SECURITY DEFINER` SQL function that returns only verified display fields and records the scan.

## Security and privacy controls

- Resident profile name, date of birth, address, phone, civil status, and issued-recipient name are encrypted with AES-256-GCM before persistence. Passwords use bcrypt. Do not rotate `DATA_ENCRYPTION_KEY` without an audited data re-encryption plan and recoverable key backup.
- Staff profile names and contact numbers are encrypted with AES-256-GCM; staff can update their own name, job title, and contact number in the staff workspace.
- Sessions are short-lived signed HTTP-only, `SameSite=Strict` cookies. Roles are assigned server-side; public registration can only create resident accounts. Staff and administrators are provisioned by administrators or the one-time seed.
- Mutating routes validate payloads, check same-origin requests, and enforce ownership/role checks. Private S3 objects use short-lived presigned URLs; uploads are size/type constrained and marked complete only after checking the stored object.
- Issued PDFs are rendered server-side, stored with S3 server-side encryption, and embed a random bearer verification token. Only the token hash is stored in PostgreSQL. Invalid, expired, revoked, and successful verification scans are recorded with a salted IP hash and bounded user-agent.
- The app adds HTTPS HSTS in production, no-referrer, frame and MIME protections, and disables caching for API responses. Deploy only behind HTTPS and configure provider-side rate limiting, private-bucket lifecycle/retention, backups, alerting, and malware scanning for uploaded files.
- These technical controls support a privacy-conscious RA 10173 implementation; they do **not** by themselves establish legal compliance. Before production use, the barangay must complete its privacy impact assessment, lawful-basis and notice review, retention/deletion schedule, processor agreements, data-subject request process, and breach-response procedures with its Data Protection Officer.

## Included routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Resident | Profile summary, request submission, requirements upload, status tracking, receipt and issued-document downloads |
| `/staff` | Staff / admin | Resident verification, request review, rejection remarks, PDF/QR issuance, audit logging |
| `GET/PATCH /api/v1/staff/profile` | Staff / admin | Read or update the signed-in staff member's own profile |
| `/admin` | Admin | Staff account management, barangay metadata, certificate validity and seal/signature setup, activity review |
| `/profile` | Resident | View/update encrypted resident profile |
| `/verify` | Public | Validate an issuance QR and show only authorized public document details |
| `POST /api/v1/auth/register` | Public | Resident registration |
| `POST /api/v1/auth/login`, `/logout` | Public / session | Session creation and termination |
| `GET/PATCH /api/v1/profile` | Resident | Read/update own profile |
| `GET/POST /api/v1/requests` | Session | List own requests or staff queue; submit a resident request |
| `PATCH /api/v1/requests/:id/decision` | Staff / admin | Start review, reject with remarks, or issue an authenticated document |
| `POST /api/v1/uploads` | Resident | Create a short-lived signed supporting-file upload |
| `GET /api/v1/verify?token=…` | Public | Audit and check an opaque verification token |
| `/api/v1/admin/*` | Admin | Staff accounts, settings, assets, and audit records |

## Operations

- `npm run db:generate` regenerates the Prisma client after schema changes.
- `npm run db:migrate` applies committed Prisma migrations to the configured direct database.
- `npm run lint`, `npm run typecheck`, and `npm run build` validate the application.
- Runtime API handlers use the Node.js runtime for Prisma, AES-GCM, PDF, and S3. Configure Vercel environment variables separately for Preview and Production; never use a production encryption key in Preview.
