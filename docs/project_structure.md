# Project structure (detailed)

This document describes the CareerNest codebase layout and provides a concise description of the frontend, backend, and database files so you can reference them directly in your report. Paths are relative to the repository root (`d:/CareerNest-Project`).

## Overview

CareerNest is a full-stack application split into two main parts:

- Frontend (`client/`): Next.js (React + TypeScript) application that implements UI, pages, and components used by students, alumni, admins and HODs.
- Backend (`server/`): Node.js + Express REST API, with helpers for database access, email, Cloudinary/S3 uploads and authentication middleware.
- Database (`server/db.sql`): PostgreSQL schema (DDL) describing all persistent entities.

The `temp/` folder contains temporary uploaded files used during local development. The `docs/` folder contains the documentation and diagrams you are creating.

---

## Frontend (client/)

Top-level files:

- `client/package.json` — NPM scripts and frontend dependencies.
- `client/next.config.ts` — Next.js configuration.
- `client/tsconfig.json` — TypeScript configuration for the client app.
- `client/tailwind.config.ts` & `client/postcss.config.*` — Tailwind CSS setup.
- `client/types.ts` — Shared type definitions used across the Next.js app.

App structure (key directories and files):

- `client/app/` — Next.js app-router pages (each folder with `page.tsx` is a route):
  - `app/page.tsx` — Landing / home page.
  - `app/login/page.tsx` — Login page.
  - `app/sign-up/page.tsx` — Sign-up page.
  - `app/forgot-password/page.tsx`, `reset-password`, `otp` etc. — Auth flows and account management.
  - `app/profile/[userId]/page.tsx` — Dynamic profile page for a user.
  - `app/jobs/page.tsx` — Jobs listing UI.
  - `app/chat/page.tsx` — Chat / conversation list UI.
  - `app/admin/`, `app/college-admin/`, `app/hod-admin/` — Role-specific dashboards and pages.

- `client/components/` — Reusable UI components: concise list of notable files (each is a React component):
  - `AppLayout.tsx` — Root layout wrapper (navigation, sidebars, page chrome).
  - `Navbar.tsx` — Top navigation component used across pages.
  - `Sidebar.tsx` — App sidebar used on authenticated pages.
  - `PostCard.tsx`, `PostPublisher.tsx`, `PostPublisherModal.tsx` — Social feed UI.
  - `ConversationWindow.tsx` — Messaging UI for a single conversation.
  - `Avatar.tsx` — User avatar component.
  - `CommentModal.tsx`, `CommentTextRenderer.tsx` — Post comments and rendering.
  - `EditProfileModal.tsx`, `OtpInput.tsx`, `PasswordStrength.tsx` — small utility UI components.
  - `ToastNotification.tsx` — Notification UI used for user feedback.

- `client/utils/` — Utility helpers used by the client: e.g., `caretUtils.ts`.

- `client/public/` — Static assets (logo, icons) included in the project bundle.

How the frontend maps to API:

- The client calls the server REST endpoints (e.g., `/api/auth/*`, `/api/onboarding/*`, `/api/jobs`) and passes JWT tokens in `Authorization: Bearer <token>` where necessary. UI components are structured so routes and components correspond to user roles (student, alumni, college-admin, HOD).

Notes for the report:

- When documenting frontend responsibilities in your report, call out `client/app/*` for route-level behavior and `client/components/*` for reusable logic and UI.

---

## Backend (server/)

Top-level files:

- `server/index.js` — Main Express server; defines API endpoints and wires middleware for uploads, authentication and routing. This is the central file for server-side business logic and route registration.
- `server/database.js` — Exports `pg` Pool or query helper used across the server modules for DB access.
- `server/db.sql` — Full SQL schema (also documented in Appendix A of the report). Use this file to extract table definitions and ER relationships.
- `server/authMiddleware.js` — JWT verification middleware and role checks (e.g., `isCollegeAdmin`, `isHODorAdmin`). Used to protect routes and attach `req.user`.
- `server/cloudinaryService.js` — Cloudinary helper for file uploads and transformations. Used by endpoints that accept images or PDF verification documents.
- `server/s3Service.js` — Optional S3 helper (presigned URLs, upload helpers) if `STORAGE_PROVIDER` is set to `s3`.
- `server/emailService.js` — Nodemailer wrapper to send OTPs, invites and notifications.
- `server/package.json` — server-side dependencies and scripts.

Key server flows and where to find them:

- Authentication & Sign-up: Implemented in `server/index.js` (routes under `/api/auth/*`). Look for multer file handling for alumni verification uploads and OTP generation.
- Onboarding: Endpoints under `/api/onboarding/*` and admin handlers under `/api/admin/*` are defined in `server/index.js` and rely on `emailService.js` + DB entries in `db.sql`.
- Jobs / Posts / Messaging: Routes for creating and listing jobs, posts, and conversations are in `server/index.js`. Business logic may be split into helper functions or modules; search the repo for route prefixes to locate exact handlers.

Notes for the report:

- Use code excerpts from `server/authMiddleware.js`, `server/cloudinaryService.js`, and the signup route in `server/index.js` as representative examples of core server behavior. These files are already included in the template sections you prepared earlier.

---

## Database (server/db.sql)

Location: `server/db.sql`

What it contains:

- Full DDL for the relational schema used by CareerNest: tables include `universities`, `departments`, `users`, `posts`, `post_media`, `post_comments`, `post_reactions`, `jobs`, `connections`, `conversations`, `messages`, along with auxiliary tables for onboarding and domains.

Key tables to reference in your report:

- `universities` — stores college metadata (name, admin email, status).
- `departments` — departments linked to a university and HOD contact.
- `users` — main user table with role and verification fields (official_email, personal_email, verification_document_url, role, status).
- `posts` / `post_media` / `post_comments` / `post_reactions` — social feed and attachments.
- `jobs` — job postings with college scoping (college_id FK).
- `connections`, `conversations`, `messages` — private messaging model.

Report tips:

- Copy the `CREATE TABLE` snippets from `server/db.sql` into Appendix A of your report. Use the ER diagram produced earlier to visualize relationships. If you need a Mermaid ER source, I can extract and generate it from `db.sql`.

---

## Helpful quick-maps (where to find things)

- Auth and OTP logic: `server/index.js`, `server/authMiddleware.js`, `server/emailService.js`
- File uploads & storage: `server/cloudinaryService.js`, `server/s3Service.js`, `temp/` (local temporary files)
- Frontend pages & routes: `client/app/*/page.tsx`
- Reusable UI: `client/components/*`
- Database schema: `server/db.sql`

## How to include these in your report

- For the Implementation or System Design sections, paste short descriptions from this file and include direct code references (file paths). Embed small code snippets from the server middleware and a representative client component to illustrate how frontend and backend interact.
- Add the ER diagram and the sequence diagrams you generated into Section 4 and reference the specific files (e.g., "see `docs/images/er-diagram.png`").

---

If you want, I can:

- Generate a Mermaid ER diagram source from `server/db.sql` and add it to `docs/`.
- Produce a concise single-page table mapping every `client/components/*.tsx` file to a one-line responsibility (useful if you want a complete inventory table for the appendix).

Which of those would you like next? 
