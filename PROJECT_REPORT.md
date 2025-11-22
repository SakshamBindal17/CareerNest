# Project Report — CareerNest

This file is a professional, ready-to-use project report template for your end-semester project (CareerNest). Replace placeholder text with your project-specific content. Use the suggested headings and guidance to create a polished document suitable for submission.

---

## Title Page
- Project Title: CareerNest
- Student Name: [Your Name]
- Student ID: [ID]
- Supervisor: [Supervisor Name]
- Department: [Department]
- Institution: [Institution Name]
- Date of submission: [DD Month YYYY]

(Include project logo or institution seal as an image, centered.)

## Declaration
I hereby declare that the work presented in this project report is my own original work except where otherwise stated and referenced.

## Acknowledgements
(Short paragraph thanking supervisor, collaborators, and any funding sources.)

## Abstract (200–350 words)
- Brief summary of the problem, approach, main contributions, and results.
- One paragraph, stand-alone.

## Keywords
- career platform, jobs, onboarding, Next.js, Node.js, cloud

## Table of Contents
(Automatically generated when exporting to PDF; otherwise create manually.)

## List of Figures
## List of Tables

---

## 1. Introduction
- Background and motivation: why this project matters.
- Problem statement: the gap you address.
- Objectives: specific, measurable goals.
- Scope and limitations.

CareerNest is a university-focused professional networking platform designed to connect students, alumni, faculty and college administrators within a private, verified community. The motivation behind CareerNest is to provide a trusted space for job postings, mentorship, onboarding of colleges, and role-based workflows (HOD approvals, college admin management) while preserving privacy and verification.

Problem statement: many public professional networks mix unrelated institutions and create noise for students and alumni. CareerNest reduces this friction by restricting membership to verified college domains, enabling college-specific job boards, and providing admin flows for onboarding and alumni verification.

Objectives:
- Deliver a secure registration and verification flow for Students, Faculty and Alumni.
- Provide role-based dashboards and workflows for College Admins and HODs.
- Implement a moderated, college-specific job board and social feed.
- Enable easy deployment and maintainability using modern web tooling.

Scope & limitations:
- Scope: core features implemented in this repository include user authentication, onboarding requests, alumni verification, job postings, posts (feed), messaging and admin dashboards.
- Limitations: not all production hardening (rate limiting, WAF rules, enterprise-grade monitoring) is implemented. The platform uses Cloudinary primarily for file storage; S3 is supported but optional.

## 2. Literature Review / Related Work
- Summarize existing solutions and how your project differs or improves.
- Cite relevant papers, platforms, or tools.

Career-focused social networks (e.g., LinkedIn) serve a broad audience but lack the controlled verification and university-specific workflows needed by campus admins. Dedicated alumni portals exist but are often proprietary. CareerNest positions itself between these extremes by offering a private, verified space with admin-led onboarding and department-level approval flows for alumni.

## 3. Requirements and Analysis
### 3.1 Functional Requirements
- User authentication and roles (student, admin, college-admin, HOD, etc.)
- Posting jobs, applying, onboarding requests, chat, profile management, etc.

Concrete functional requirements implemented in the repo:
- Sign-up (Students/Faculty using official college email domain, Alumni with document upload).
- OTP-based email verification and password reset flows.
- College onboarding (request + OTP + Super-Admin approval) and automatic College Admin creation.
- Department management and HOD invitation workflow.
- Job posting with application link/email and listing per college.
- Posts, comments, reactions and media attachments (post_media table).
- Connections and private messaging (connections, messages tables).

### 3.2 Non-functional Requirements
- Performance, security, scalability, availability, usability, accessibility.

### 3.3 Use Cases / User Stories
- Provide diagrams or a short table of key user flows.

## 4. System Design
### 4.1 Architecture Overview
- Describe high-level architecture (client/server separation, DB, storage, cloud services).
- Include an architecture diagram (e.g., `docs/images/architecture.png`).

High-level architecture (as implemented):
- Client: Next.js (React, TypeScript) – renders the UI, handles client-side routing, and calls the backend REST API.
- Server: Node.js + Express (`server/index.js`) – exposes REST endpoints, performs business logic, and interacts with the database and storage.
- Database: PostgreSQL (`server/db.sql`) – stores users, posts, jobs, departments, universities and related entities.
- Storage: Cloudinary for file uploads (images, verification PDFs); optional S3 support via `server/s3Service.js`.
- Email: Nodemailer sends OTPs, welcome emails, password-reset links.

Diagram: add `docs/images/architecture.png` that shows: Client (Next.js) -> Server (Express) -> Database (Postgres) and Storage (Cloudinary/S3); include JWT flow between client and server.

### 4.2 Data Model
- ER diagram and brief table of main entities (User, Post, Job, Request, Conversation).
- Include schema snippets or reference to `server/db.sql`.

Key entities (high-level):
- universities — registered colleges
- departments — per-university departments, HOD contact
- users — students, alumni, faculty, admins (stores verification document URL for alumni)
- posts / post_media / post_comments / post_reactions — social feed and reactions
- jobs — job postings per college
- connections / messages — private connections + messaging

The full SQL schema is available in `server/db.sql` and an excerpt is included in Appendix A.

### 4.3 Component Design
- Explain key components (Next.js client, Node.js server, Cloudinary/S3, email service).
- Sequence diagrams for critical flows (signup, job application, onboarding request).

### 4.4 API Design
- List key endpoints, request/response shapes, authentication method (JWT, cookies), status codes.

Authentication: JWT tokens issued on successful login (`jsonwebtoken`) and sent by the client in the `Authorization: Bearer <token>` header. The middleware `server/authMiddleware.js` decodes the token and attaches `req.user`.

Key REST endpoints (non-exhaustive) implemented in `server/index.js`:
- Public
  - GET /api/public/colleges — returns active colleges and domains
  - GET /api/public/departments/:collegeId — returns departments for a college

- Onboarding
  - POST /api/onboarding/request-otp — request OTP to onboard a college
  - POST /api/onboarding/verify-otp — verify college OTP

- Auth
  - POST /api/auth/signup — sign up (multipart for alumni document)
  - POST /api/auth/verify-otp — verify user OTP
  - POST /api/auth/login — login and retrieve JWT
  - POST /api/auth/forgot-password — request password reset
  - POST /api/auth/reset-password — reset password via token

- Admin (protected)
  - GET /api/admin/onboarding-requests
  - POST /api/admin/approve-request
  - POST /api/admin/reject-request

- College Admin (protected: isCollegeAdmin)
  - GET/POST/DELETE /api/college-admin/domains
  - GET/POST/PUT/DELETE /api/college-admin/departments
  - GET /api/college-admin/stats
  - GET /api/college-admin/report

- HOD (protected: isHODorAdmin)
  - GET /api/hod-admin/alumni-queue
  - POST /api/hod-admin/verify-alumnus
  - GET /api/hod-admin/document/:userId and /api/hod-admin/document-link/:userId
  - GET /api/hod-admin/department-roster

- Main Platform
  - GET /api/people — search & paginated list
  - GET /api/jobs and POST /api/jobs — list and create jobs

For each endpoint, status codes follow REST conventions (200/201 for success, 400 for client errors, 401/403 for auth/permission issues, 500 for server errors). See Appendix B for a compact endpoint table.

## 5. Implementation
### 5.1 Technology Stack
- Frontend
  - Next.js (app router) — Next 16 / React 19, TypeScript for types and safety.
  - Tailwind CSS for styling and utility-first design.
  - Libraries: `lucide-react` (icons), `link-preview-js`, `react-icons`.

- Backend
  - Node.js with Express (server entry: `server/index.js`).
  - PostgreSQL as the primary relational database (connection via `pg` and `server/database.js`).
  - Authentication: JWT (`jsonwebtoken`) with an `authMiddleware` layer in `server/authMiddleware.js`.
  - File storage: Cloudinary (primary) via `server/cloudinaryService.js`; optional S3 support (`@aws-sdk/*`, `server/s3Service.js`).
  - Email: Nodemailer used by `server/emailService.js`.

- Dev / Ops / Others
  - Dev tools: `nodemon` for server dev, ESLint for linting, TypeScript on the client-side.
  - Key runtime / env requirements: `.env` entries for DB credentials, `JWT_SECRET`, Cloudinary keys, and optional AWS keys.
  - Project scripts: server uses `nodemon index.js` (see `server/package.json`), client uses `next dev`/`next build` (see `client/package.json`).

### 5.2 Module-wise Implementation
- High-level modules and key files (repository-specific)
  - client/
    - `client/app/layout.tsx` — root layout, theme/provider wiring and global styles (`globals.css`).
    - `client/app/page.tsx` — Landing / home page and hero components.
    - `client/components/*` — UI building blocks: `Navbar.tsx`, `PostCard.tsx`, `PostPublisher.tsx`, `ConversationWindow.tsx`, `Avatar.tsx`, etc.
    - `client/styles` and `tailwind.config.ts` — Tailwind and global styling configuration.

  - server/
    - `server/index.js` — Main API server, defines REST endpoints (auth, onboarding, college-admin, HOD, jobs, posts, messaging) and middleware wiring (multer for file upload, Cloudinary/S3 integration).
    - `server/database.js` — `pg` Pool wrapper and exported `query` helper used across the server.
    - `server/authMiddleware.js` — JWT verification and role-based middleware helpers (`isCollegeAdmin`, `isHODorAdmin`, `isDelegate`).
    - `server/cloudinaryService.js` — Cloudinary upload helper (uploads images and PDFs, auto-detects resource type).
    - `server/s3Service.js` (optional) — S3 upload/presign helpers (repository contains S3 integration).
    - `server/emailService.js` — Nodemailer helper to send OTPs, reset links, and notifications.
    - `server/db.sql` — Full SQL schema and migrations (ER definitions and table DDL).

  - How modules interact
    - The Next.js client calls REST endpoints implemented in `server/index.js` (e.g., `/api/auth/*`, `/api/onboarding/*`, `/api/college-admin/*`).
    - File uploads from the client are temporarily stored by `multer` (server `temp/` folder) and then uploaded to Cloudinary (or S3) and the URL saved in the DB (`users.verification_document_url`, `post_media.media_url`).
    - Authentication flow: signup => OTP email via `emailService` => user verifies OTP => `users` row updated; login => JWT issued and used to access protected routes.

  - Notable configuration / environment variables (examples)
    - `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_NAME`, `DB_PORT`
    - `JWT_SECRET`
    - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
    - `STORAGE_PROVIDER` (optional: `cloudinary` or `s3`) and AWS credentials if using S3


### 5.3 Important Code Snippets
- Insert 2–3 short, well-explained snippets (authorization middleware, database query, key UI logic).
- Keep code concise, highlight the rationale and complexity.

Below are two concise, documented snippets taken from the repo that illustrate core flows.

1) JWT auth middleware (`server/authMiddleware.js`) — verifies token and enforces role-based access:

```javascript
// checks Authorization header, verifies JWT and attaches req.user
const jsonwebtoken = require('jsonwebtoken');
const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token, authorization denied.' });
  try {
    const decoded = jsonwebtoken.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user; // { id, role, college_id, department_id }
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token is not valid.' });
  }
};
```

Why this matters: a single middleware centralizes authentication, reduces duplication, and supports role-based wrappers (isCollegeAdmin, isHODorAdmin) used across routes.

2) Signup flow (file upload + domain validation) — excerpt from `/api/auth/signup` in `server/index.js`:

```javascript
// multer stores file to temp/, then file is uploaded to Cloudinary and URL saved
const { uploadFile } = require('./cloudinaryService');
app.post('/api/auth/signup', upload.single('verificationFile'), async (req, res) => {
  // Extract fields and optional file
  const { fullName, email, password, role, collegeId } = req.body;
  const file = req.file;

  // If role != Alumni, enforce official email domain
  const domains = await db.query('SELECT domain FROM college_domains WHERE college_id = $1', [collegeId]);
  if (role !== 'Alumni' && !domains.rows.map(r => r.domain).includes(email.split('@').pop())) {
    return res.status(400).json({ error: 'Official email required.' });
  }

  // If Alumni, upload verification file to Cloudinary
  let fileUrl = null;
  if (role === 'Alumni') fileUrl = await uploadFile(file.path, 'career-nest/verification-proofs', file.originalname, file.mimetype);

  // Hash password, save user, send OTP email
});
```

Why this matters: shows file handling, Cloudinary upload, domain validation, and OTP-driven verification which are central user flows for trust/verification.

## 6. Testing
### 6.1 Test Strategy
- Unit tests, integration tests, end-to-end, manual testing checklist.

Testing approach used for this project (practical and manual):
- Manual functional testing for signup/login flows, OTP, onboarding, HOD approvals and job posting.
- Integration-level checks performed by running the server locally and exercising endpoints (e.g., `/api/auth/signup`, `/api/hod-admin/verify-alumnus`).
- Suggested automated tests (future): unit tests for helpers (db queries), integration tests using a test Postgres DB and Supertest for endpoints, and E2E tests using Playwright against the Next.js UI.

### 6.2 Test Cases and Results
- Provide sample test cases (input, expected output) and results.
- Attach screenshots of test runs, CI pipeline if any.

Sample test case (Signup + Verify OTP):
- Input: POST `/api/auth/signup` with role=Student, email=user@college.edu, password=Pass123, collegeId=1
- Expected: 200 OK, message 'Sign-up successful! An OTP has been sent to your email.'; DB: new `users` row with status `pending_email_verification` and `otp` stored.

Sample manual result recorded: OTP email sent via `emailService` when testing locally (Nodemailer configured to a test SMTP); user record updated to `active` after `/api/auth/verify-otp`.

### 6.3 Bug Tracking
- Tools used, major bugs found and fixes applied.

## 7. Deployment & Operations
### 7.1 Deployment Architecture
- Hosting (Vercel/Netlify for frontend, Heroku/AWS/Render for server, managed DB), domain configuration.

Deployment recommendations based on repo:
- Frontend: Deploy to Vercel (Next.js native). Build command: `next build`.
- Backend: Deploy to Render/Heroku/AWS EC2 or Elastic Beanstalk; server listens on port 3001 (changeable via env).
- Database: Managed PostgreSQL (Heroku Postgres, AWS RDS, or Supabase).

Use environment variables (listed in the next subsection) and ensure Cloudinary/AWS credentials are configured in the production environment.

### 7.2 Setup and Installation
- Step-by-step setup (condensed). Mention `ENV` keys required, how to run locally and in production.

Local setup (Windows PowerShell examples):

```powershell
# From project root
cd .\server
npm install
# create .env with required variables (see below)
npm start

# In another terminal
cd ..\client
npm install
npm run dev
```

Minimum `.env` variables required by the server:
- DB_USER, DB_PASSWORD, DB_HOST, DB_NAME, DB_PORT
- JWT_SECRET
- CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
- Optional: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, STORAGE_PROVIDER=s3

Example `.env` snippet (do NOT commit secrets):

```
DB_USER=postgres
DB_PASSWORD=supersecret
DB_HOST=localhost
DB_NAME=careernest
DB_PORT=5432
JWT_SECRET=your_jwt_secret_here
CLOUDINARY_CLOUD_NAME=example
CLOUDINARY_API_KEY=abc
CLOUDINARY_API_SECRET=xyz
```

### 7.3 CI/CD and Monitoring
- Describe build, deploy steps, and any monitoring/alerts in place.

## 8. Security, Privacy & Ethics
- Authentication and authorization model, sensitive data handling, password hashing, HTTPS, CORS.

Security highlights implemented:
- Passwords hashed with bcrypt before storage (no plaintext passwords).
- JWT-based authentication with token expiry.
- Role-based access control via `authMiddleware` and helper wrappers (`isCollegeAdmin`, `isHODorAdmin`).
- CORS enabled on the server; ensure production origins are restricted.
- Verification documents are stored in Cloudinary (or S3) and access is mediated: HOD endpoints return presigned or proxied URLs.

Privacy & ethics notes:
- Alumni verification documents contain sensitive PII; ensure Cloudinary/S3 access is restricted and that any downloaded copies are handled securely.
- Only authorized roles can access sensitive documents: HODs and College Admins as implemented.
- Privacy considerations and compliance (if applicable).

## 9. Performance Evaluation
- Measurements: response times, throughput, resource usage.
- Test methodology and results (load tests, profiling screenshots).

Notes: No formal load testing was run in this repository. For production readiness, run a small load test (k6 or ApacheBench) against key endpoints (login, /api/people, /api/jobs) and profile database queries for slow queries (use EXPLAIN ANALYZE for expensive joins). Cache frequently-read public objects (college list) where necessary.

## 10. User Manual / Demo Guide
- How to use the main features, with annotated screenshots.
- Provide a short step-by-step demo script for evaluators.

Quick demo script (for evaluators):
1. Start server and frontend locally (see Setup).
2. Navigate to the site landing page (`http://localhost:3000`).
3. Sign up as a Student using a dummy college email (match `college_domains` in the DB), receive OTP via email, verify OTP.
4. As a Super Admin (or by inserting a row in `universities`) test onboarding: POST `/api/onboarding/request-otp`, verify and have the Super Admin approve via `/api/admin/approve-request`.
5. As a College Admin, add a department and invite HOD, verify HOD flow.
6. Post a job via `/api/jobs` and view it in the jobs feed.

Include screenshots in `docs/images/` and reference them from relevant sections.

## 11. Project Management
### 11.1 Timeline
- Gantt or milestone chart summary (screenshot or image `docs/images/gantt.png`).

Milestones (example actuals):
- Week 1–2: Requirements, DB schema and basic Next.js scaffold
- Week 3–4: Implement auth, signup, OTP flows, and DB migration scripts
- Week 5–6: Implement onboarding and admin flows, department/HOD workflows
- Week 7–8: Posts, jobs, messaging and UI polish
- Week 9: Manual testing, documentation and final fixes

### 11.2 Team Roles (if any)
- Who did what; contribution matrix.

### 11.3 Effort & Cost Estimation
- Rough person-hours and hosting/cloud costs if relevant.

## 12. Future Work
- Improvements, extensions and research directions.

Suggested future improvements:
- Add automated tests (unit/integration/E2E) and CI pipeline.
- Add rate limiting and request throttling, WAF rules and IP-level protections.
- Add analytics and monitoring (Prometheus/Grafana or external provider).
- Implement richer role-based UI and audit logs for admin actions.

## 13. Conclusion
- Brief summary of achievements and impact.

CareerNest implements a focused, verified, and role-aware networking platform. The project delivers a full-stack solution that covers onboarding, verification, role-based workflows and a social/job feed tailored to universities. It can be extended to production with additional hardening and monitoring.

## References
- List books, articles, API docs, packages (use a consistent citation style).

- Node.js and Express documentation
- Next.js documentation
- Cloudinary docs
- PostgreSQL documentation
- Relevant npm packages listed in `server/package.json` and `client/package.json`

## Appendices
 - A: Database schema (full SQL) — reference `server/db.sql` or paste here.
   - A.1 Key tables excerpt (see full file `server/db.sql`):
     ```sql
     -- universities (stores approved colleges)
     CREATE TABLE universities (
       university_id SERIAL PRIMARY KEY,
       name VARCHAR(255) NOT NULL,
       admin_name VARCHAR(255) NOT NULL,
       admin_email VARCHAR(255) NOT NULL UNIQUE,
       status VARCHAR(50) DEFAULT 'active',
       created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
     );

     -- users (students, faculty, alumni, admins)
     CREATE TABLE users (
       user_id SERIAL PRIMARY KEY,
       full_name VARCHAR(255) NOT NULL,
       official_email VARCHAR(255) UNIQUE,
       personal_email VARCHAR(255) UNIQUE,
       password_hash VARCHAR(255),
       role VARCHAR(50) NOT NULL,
       status VARCHAR(50) NOT NULL,
       college_id INT REFERENCES universities(university_id) ON DELETE SET NULL,
       created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
     );
     ```
 - B: API reference (detailed endpoints).
 - B: API reference (detailed endpoints).
   - See section 4.4 for the main endpoints.
   - Compact table (endpoint / method / auth / brief description):
     - GET /api/public/colleges — public — list active colleges and domains
     - POST /api/onboarding/request-otp — public — request OTP to onboard a college
     - POST /api/auth/signup — public (multipart) — create user account (alumni may upload document)
     - POST /api/auth/login — public — login returns JWT
     - POST /api/college-admin/domains — protected (College Admin) — add domain
     - POST /api/hod-admin/verify-alumnus — protected (HOD) — approve/reject/transfer alumni
     - GET /api/jobs, POST /api/jobs — protected — list and create jobs

 - C: Configuration files (important snippets)
   - Example `.env` values (do NOT commit secrets):
     ```env
     DB_USER=postgres
     DB_PASSWORD=supersecret
     DB_HOST=localhost
     DB_NAME=careernest
     DB_PORT=5432
     JWT_SECRET=your_jwt_secret_here
     CLOUDINARY_CLOUD_NAME=example
     CLOUDINARY_API_KEY=abc
     CLOUDINARY_API_SECRET=xyz
     STORAGE_PROVIDER=cloudinary
     ```

 - D: Test logs and CI output.

---

## Images, Diagrams, and File Naming Guidance
- Create a folder `docs/images/` in the repo and put all images there. Use descriptive filenames:
  - `architecture.png`, `er-diagram.png`, `sequence-signup.png`, `screenshot-home.png`, `gantt.png`.
- Image size & quality: 1200px width for full-width diagrams; export vector diagrams as SVG where possible.
- Provide captions under each figure and reference them in text (e.g., "Figure 3.1: System architecture").
- When adding screenshots, crop to the relevant region and annotate (arrows, boxes) to highlight features.

## Formatting and Submission Tips
- Font: Times New Roman or similar; body 11–12pt; line spacing 1.15–1.5.
- Margins: standard (1 inch / 2.54 cm).
- Keep consistent heading numbering and captions.
- Number pages and include header/footer with project title and page number.

## Converting to PDF
- Option A: Use VS Code Markdown PDF or "Markdown: Export (PDF)" extensions.
- Option B: Use Pandoc for finer control (template, header/footer). If you want commands for Pandoc on Windows PowerShell, I can provide them.

## Suggested Length and Distribution
- Total: 20–40 pages depending on level of detail.
  - Abstract: 0.5 page
  - Intro & Lit Review: 3–6 pages
  - Design & Implementation: 8–15 pages
  - Testing & Results: 3–6 pages
  - Appendices & References: remaining pages

## Sample Checklist Before Submission
- [ ] All placeholders replaced with real content.
- [ ] Figures have captions and are referenced from text.
- [ ] At least one ER diagram and one architecture diagram included.
- [ ] SQL schema included in Appendix.
- [ ] Proofread for grammar and consistency.
- [ ] PDF exported and checked for page breaks.

---

## How to use this file
1. Copy this file to `docs/PROJECT_REPORT.md` or keep it at the root.
2. Replace placeholders and fill each section with project-specific details.
3. Add diagrams/screenshots to `docs/images/` and include them using relative links in the Markdown.
4. Export to PDF once content is final.


---

Good luck — if you want, I can now:
- Fill this template with project-specific content by scanning your repo and extracting key details (architecture, tech stack, code snippets, DB schema, screenshots). OR
- Generate diagram images (ER diagram / architecture) from the current repo structure and SQL schema. Which would you like next?
