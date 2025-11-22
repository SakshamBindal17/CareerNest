# 4. System Design

## 4.1 Architecture Overview
The system is a typical full-stack separation:

- Client: Next.js (React + TypeScript) — located in `client/` in the repo. Uses the app router and server components for pages listed under `client/app/`.
- Server: Node.js + Express — `server/index.js` exposes REST endpoints for auth, onboarding, jobs, posts, and admin actions.
- Database: PostgreSQL — schema and DDL in `server/db.sql`.
- Storage: Cloudinary for file uploads; optional S3 in `server/s3Service.js`.
- Email: Nodemailer via `server/emailService.js` for OTPs and notifications.

Place architecture diagram at `docs/images/architecture.png` and reference it here as Figure 4.1.

## 4.2 Data Model
Include an ER diagram `docs/images/er-diagram.png`. Key entities:

- universities (university_id PK)
- departments (department_id PK, university_id FK)
- users (user_id PK, college_id FK)
- posts, post_media, post_comments, post_reactions
- jobs (job_id PK, college_id FK)
- connections, conversations, messages

Refer to `server/db.sql` for the full schema and include an excerpt in the appendix.

## 4.3 Component Design
- Client components: `client/components/*` — `Navbar.tsx`, `PostCard.tsx`, `PostPublisher.tsx`, `ConversationWindow.tsx`, `Avatar.tsx`.
- Server modules: `server/index.js`, `server/database.js`, `server/authMiddleware.js`, `server/cloudinaryService.js`, `server/emailService.js`.

Add sequence diagrams for signup (`docs/images/sequence-signup.png`) and onboarding (`docs/images/sequence-onboarding.png`).

## 4.4 API Design
Authentication uses JWT (token returned on login, sent as `Authorization: Bearer <token>`). Middleware `server/authMiddleware.js` parses token and attaches `req.user`.

Representative endpoints:
- POST /api/auth/signup — sign up (multipart for alumni verification file)
- POST /api/auth/login — returns JWT
- POST /api/onboarding/request-otp — request OTP for college onboarding
- POST /api/admin/approve-request — Super Admin approves onboarding
- GET/POST /api/jobs — list/create jobs

Include a compact endpoint table in Appendix B or here as needed.
