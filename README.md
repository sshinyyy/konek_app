# Konek Barangay

Resident profiling, online document requests, staff processing, certificate generation, and public QR verification for Barangay Banonong, Dapitan City. The system is built with Next.js App Router, TypeScript, Tailwind CSS, Prisma, PostgreSQL, and an S3-compatible private bucket.

## Requirements

- Node.js 20.9 or newer
- PostgreSQL 14+ (Supabase is supported)
- A private S3-compatible bucket with provider-managed encryption enabled
- Upstash Redis REST credentials for distributed production rate limiting
- HTTPS public URL for production certificate verification

## Configure and run locally

1. Copy `.env.example` to `.env` and configure both PostgreSQL URLs, the independent session, encryption, and IP-hashing secrets, the public app URL, S3 credentials, and Upstash credentials. Generate a 32-byte AES key with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and a session secret with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`. Keep secrets and recoverable encryption-key backups in a managed secret store; never paste their values into source control or support messages.
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

Keep the bucket private; the application generates short-lived signed URLs for each file. Supabase Storage's S3-compatible API does not support the S3 `PutBucketCors` operation or `x-amz-server-side-encryption` request header. Do not add unsupported S3 encryption headers to uploads; Supabase manages storage encryption.

New installations default to Barangay Banonong, Dapitan City, Zamboanga del Norte. The identity migration changes defaults only and deliberately does not overwrite an existing `BarangaySettings` row. Before issuing any real document, an authorized administrator must review and save the actual barangay name, municipality, province, captain name, office address, contact number, certificate validity, seal, and signature in `/admin`. Request receipts and certificates use the saved settings.

`DIRECT_URL` is used for schema migrations and must have permission to create tables, functions, policies, and grant privileges. Before migration, provision a `konek_app` database role with a strong secret; the RLS migration grants that role runtime table access. Set `DATABASE_URL` to this role through the runtime pooler. It must **not own tables and must not have `BYPASSRLS`**; otherwise PostgreSQL intentionally bypasses row policies. Supabase service-role credentials bypass RLS and must not be used as the runtime database role. The RLS migration uses transaction-local `app.current_user_id` / `app.current_user_role` values, set by `withRlsContext` for protected resident data. Public QR lookups use a restricted `SECURITY DEFINER` SQL function that returns only verified display fields and records the scan.

## Security and privacy controls

- Resident profile name, date of birth, address, phone, civil status, and issued-recipient name are encrypted with AES-256-GCM before persistence. Passwords use bcrypt. Do not rotate `DATA_ENCRYPTION_KEY` without an audited data re-encryption plan and recoverable key backup.
- Staff profile names and contact numbers are encrypted with AES-256-GCM; staff can update their own name, job title, and contact number in the staff workspace.
- Sessions are short-lived signed HTTP-only, `SameSite=Strict` cookies. Roles are assigned server-side; public registration can only create resident accounts. Staff and administrators are provisioned by administrators or the one-time seed.
- Every protected server request rechecks that the account is active and that its stored role still matches the session, so disabling an account or changing its role invalidates the old session on its next server request. The Next.js Proxy performs only an optimistic token check; authorization is enforced again by server pages and API handlers.
- Mutating routes validate payloads, check same-origin requests, and enforce ownership/role checks. Private S3 objects use short-lived presigned URLs; uploads are size/type constrained and marked complete only after checking the stored object.
- Supporting uploads are written first to the private `quarantine/` prefix and checked against actual file signatures and size/type metadata before they are copied to `requirements/`. Malware scanning is not implemented: uploads are unscanned, are marked `COMPLETE` rather than `CLEAN`, and the staff interface warns reviewers before opening them. File signature checks are not a substitute for malware detection; staff should open files only when they trust the resident and file. Staff download routes deny pending or rejected files. Configure a private-bucket lifecycle rule to remove abandoned objects in `quarantine/`.
- Login, registration, public QR verification, and upload URL creation use atomic fixed-window rate limits stored in Upstash Redis. Default limits are 10 login attempts/minute, 5 registrations/hour, 30 verifications/minute, and 10 upload URLs/hour. Each limit and window can be overridden with the matching `RATE_LIMIT_<NAME>_MAX` and `RATE_LIMIT_<NAME>_WINDOW_SECONDS` environment variables. Production requests fail closed with a 503 if Redis protection is unavailable or unconfigured.
- Issued PDFs are rendered server-side, stored in the private storage bucket, and embed a QR link containing a random bearer verification token. Only the token hash is stored in PostgreSQL. The token is not described as encrypted or digitally signed. Invalid, expired, revoked, and successful verification scans are recorded with a salted IP hash and bounded user-agent.
- The app adds HTTPS HSTS in production, no-referrer, frame and MIME protections, and disables caching for API responses. Configure private-bucket lifecycle/retention, backups, alerting, and provider agreements. These controls do not themselves establish legal compliance.
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
- Prisma schema and migrations are the source of truth for entity fields, database types, declared lengths, defaults, and relationships. Update diagrams and data dictionaries from those definitions; do not infer lengths from generic `VARCHAR` or `TEXT` labels.

## Validation and release checklist

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` locally before release. Apply schema changes only after reviewing the migration and using an authorized non-production database first. Never run smoke tests against production resident data.

### Safe preview smoke test

Use a dedicated preview deployment with isolated database/storage resources, synthetic resident details, and a test staff account:

1. Register a test resident, sign in, and confirm the resident profile loads and can be updated.
2. Submit a request using synthetic information and a harmless test PDF/image. Confirm it remains private in quarantine until file signature and size/type checks succeed.
3. Confirm the upload is marked as not malware-scanned and is available only to authorized staff after validation. Confirm invalid, mismatched, and oversized files are blocked.
4. Sign in as test staff; review the request. Test rejection with remarks, then use a separate request to issue a document.
5. Download the request receipt and issued PDF; confirm both use the saved Banonong settings and the issued document contains a QR verification link.
6. Verify the QR token and check that only intended public details are returned. Repeat with an invalid token and confirm the invalid result is logged without disclosing resident profile data.
7. Disable the test staff account in the admin console and confirm its existing session can no longer access protected pages or APIs.
8. Exercise each configured rate limit using test requests and confirm excess attempts return HTTP 429 with `Retry-After`. Do not run high-volume load tests against shared services.
9. Delete synthetic test accounts/records and uploaded objects using the approved preview cleanup procedure.

### Authorized production readiness checks

Before production use, a designated administrator must verify the Vercel Production environment variables, database role/RLS behavior, encryption-key backup and restore plan, Upstash limits, private-bucket lifecycle and access policies, and Banonong certificate settings. Supporting files are not malware-scanned; administrators must decide whether this residual risk is acceptable before enabling real resident document processing. An authorized operator should perform a limited smoke test only with approved synthetic/test accounts and a documented cleanup plan. Do not issue a real certificate or use actual resident information as a deployment test.

The Barangay Data Protection Officer must finalize the privacy notice and determine applicable lawful bases, retention/deletion schedule, provider agreements, data-subject request procedures, backup/recovery, access-review, and breach-response processes before real resident data is processed. This software does not certify compliance with RA 10173.
