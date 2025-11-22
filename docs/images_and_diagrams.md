# Images and Diagrams (what to capture/create and where to place them)

This file lists the images you should include in your final project report, where to place them, and provides detailed prompts you can paste into Mermaid AI (or a similar tool) to generate vector diagrams. For project screenshots, capture them locally and save into `docs/images/screenshots/` as indicated.

Directory structure (recommended):

- `docs/images/architecture.png` — Architecture diagram (place in Section 4.1)
- `docs/images/er-diagram.png` — ER diagram (place in Section 4.2)
- `docs/images/sequence-signup.png` — Signup sequence diagram (place in Section 4.3)
- `docs/images/sequence-onboarding.png` — Onboarding sequence diagram (Section 4.3)
- `docs/images/sequence-job-apply.png` — Job-application sequence (place in Implementation / Demo)
- `docs/images/gantt.png` — Project timeline / Gantt (place in Section 11.1)
- `docs/images/tests/` — test run screenshots and performance graphs (place in Section 6 and 9)
- `docs/images/screenshots/` — UI screenshots (place in Section 10 User Manual)

Naming and placement guidance (short):
- Use descriptive, lowercase filenames with hyphens. Prefer SVG or PNG.
- Insert each image under the relevant section with a caption, e.g. `Figure 4.1: System architecture`.

---

Mermaid AI prompts (detailed) — copy/paste these into the Mermaid AI prompt box to generate diagrams that match the project. Be explicit about entities, relationships, layout, labels and export format (SVG/PNG). I included extra context so the generated diagrams require minimal editing.

1) Architecture diagram (place as `docs/images/architecture.png` in Section 4.1)

Prompt for Mermaid AI:

"Create a clear, professional architecture diagram for a web application named CareerNest. Use a left-to-right layout. Show these components as labeled boxes and arrows:

- Client (Next.js, React, TypeScript) — label: 'Client (Next.js app)'.
- API Server (Node.js + Express) — label: 'Server (Node.js + Express)'.
- Database (PostgreSQL) — label: 'Postgres DB'.
- File Storage (Cloudinary / optional S3) — label: 'Cloudinary / S3'.
- Email Service (SMTP / Nodemailer) — label: 'Email (Nodemailer)'.

Draw arrows:
- Client -> Server: 'REST API (JWT Bearer token)'.
- Server -> Database: 'SQL queries (pg)'.
- Server -> Cloudinary/S3: 'Upload & retrieve media URLs'.
- Server -> Email (Nodemailer): 'OTP & notifications'.

Add small annotations for security and auth: show a 'JWT' token icon between Client and Server, label it 'Authorization: Bearer <token>' and indicate 'authMiddleware verifies token' on the Server box. Use boxed groupings or subtle background colors to visually group 'Frontend', 'Backend', and 'Storage'. Provide a legend and export as a high-resolution PNG with a neutral color palette suitable for a report."

2) ER Diagram (place as `docs/images/er-diagram.png` in Section 4.2)

Prompt for Mermaid AI:

"Generate an ER diagram (use mermaid `erDiagram` or clear entity boxes) listing these tables and relationships for CareerNest:

- universities: university_id PK, name, admin_name, admin_email, status, created_at
- departments: department_id PK, name, university_id FK -> universities.university_id
- users: user_id PK, full_name, official_email, personal_email, password_hash, role, status, college_id FK -> universities.university_id, created_at
- posts: post_id PK, author_id FK -> users.user_id, content, created_at
- post_media: media_id PK, post_id FK -> posts.post_id, media_url, media_type
- jobs: job_id PK, title, description, company, college_id FK -> universities.university_id, created_at
- connections: connection_id PK, user_a FK -> users.user_id, user_b FK -> users.user_id, status
- conversations: conversation_id PK, created_at
- messages: message_id PK, conversation_id FK -> conversations.conversation_id, sender_id FK -> users.user_id, content, created_at

Show relationships with crow's foot notation or arrows, label FK fields, and arrange the layout horizontally with `universities` and `departments` at the top. Use color accents for PK fields (bold) and FK fields (italic). Export as SVG.
"

3) Sequence diagram — Signup (place as `docs/images/sequence-signup.png` in Section 4.3)

Prompt for Mermaid AI:

"Create a sequence diagram for the user signup flow in CareerNest. Participants: User (Browser), Next.js Client, Server (Express), Email Service (SMTP), Database (Postgres). Steps:

1. User submits signup form (email, password, role, optional file for alumni) from Client.
2. Client -> Server: POST /api/auth/signup (multipart if file).
3. Server validates domain or requires document for alumni, stores temporary file, calls Cloudinary to upload (if file present) and stores URL.
4. Server creates a `users` row with status `pending_email_verification` and generates an OTP.
5. Server -> Email Service: send OTP to user email.
6. Email Service sends OTP; Client shows message 'OTP sent'.
7. User enters OTP -> Client -> Server: POST /api/auth/verify-otp.
8. Server verifies OTP, updates user status to `active`, returns success and (optionally) JWT for login.

Make the diagram simple but include callouts for 'multer -> temp file' and 'Cloudinary upload' steps. Use clear labels and export as PNG." 

4) Sequence diagram — College onboarding (place as `docs/images/sequence-onboarding.png` in Section 4.3)

Prompt for Mermaid AI:

"Create a sequence diagram for the college onboarding flow in CareerNest. Participants: Requester (Client), Server, Super Admin, Database, Email Service. Steps:

1. Requester submits onboarding request via POST /api/onboarding/request-otp.
2. Server generates OTP and stores request with status `pending` in DB.
3. Server sends OTP to requester email via Email Service.
4. Requester verifies OTP via POST /api/onboarding/verify-otp.
5. Server validates OTP and creates an onboarding request entry in DB.
6. Super Admin reviews the onboarding requests via GET /api/admin/onboarding-requests.
7. Super Admin approves via POST /api/admin/approve-request; Server sets `universities.status = active` and creates initial College Admin user.

Use clear labels for DB updates and for any PR/approval step. Export as PNG." 

5) Sequence diagram — Job apply flow (place as `docs/images/sequence-job-apply.png` near Implementation/User Manual)

Prompt for Mermaid AI:

"Create a short sequence diagram showing: Student -> Client -> Server: GET /api/jobs -> list jobs; Student clicks Apply -> Client -> Server: POST /api/jobs/:id/apply (or link to external email). Show server notifying company or returning application link. Keep simple and export PNG." 

6) Project timeline / Gantt (place as `docs/images/gantt.png` in Section 11.1)

Prompt for Mermaid AI:

"Generate a simple Gantt chart spanning 9 weeks with these milestones:

- Weeks 1–2: Requirements and scaffold
- Weeks 3–4: Auth & OTP flows
- Weeks 5–6: Onboarding & admin flows
- Weeks 7–8: Posts, jobs, messaging
- Week 9: Testing and documentation

Label tasks with start/end week and export as PNG suitable for inclusion in an academic report." 

7) Visual style and export tips for Mermaid AI

- Request a high-resolution PNG or SVG and neutral/paper-friendly color palette.
- Ask Mermaid AI to center the diagram on a white background, include a short caption text box and to export with an option to download a vector (SVG) if possible.

---

Where to place images in the report (concise mapping):

- `docs/images/architecture.png` -> Section 4.1 (System Design)
- `docs/images/er-diagram.png` -> Section 4.2 (Data Model)
- `docs/images/sequence-signup.png` -> Section 4.3 (Component Design / Sequence diagrams)
- `docs/images/sequence-onboarding.png` -> Section 4.3 (Component Design)
- `docs/images/sequence-job-apply.png` -> Implementation or User Manual
- `docs/images/gantt.png` -> Section 11.1 (Timeline)
- `docs/images/screenshots/*.png` -> Section 10 (User Manual) and sprinkle screenshot references in Implementation and Testing sections
- `docs/images/tests/*` -> Section 6 (Testing) and Section 9 (Performance)

Screenshot capture notes

- Use 1200px width for full-width images. Crop tightly to focus on relevant UI.
- Name screenshots clearly, e.g., `screenshot-signup.png`, `screenshot-profile.png`, `screenshot-job-post.png`.
- Annotate screenshots in an image editor (arrows, boxes) to highlight flows if required by evaluators.

If you want, I can generate the Mermaid code for the ER and sequence diagrams from `server/db.sql` and the repo code to give you a ready-to-render starting point. Tell me which diagrams you want first and I will extract the schema and produce Mermaid syntax.
