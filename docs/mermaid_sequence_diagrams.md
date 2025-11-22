# Mermaid Sequence Diagrams — Signup & Onboarding

This file contains ready-to-render Mermaid code for the two main sequence diagrams used in the report: the user signup flow and the college onboarding flow. You can paste the Mermaid sections directly into Mermaid AI, the Mermaid Live Editor (https://mermaid.live), or any Markdown renderer that supports Mermaid blocks.

Instructions:
- If using Mermaid AI: paste the Mermaid code only (including the first line `sequenceDiagram`) into the prompt or editor. Request export as PNG or SVG at high resolution.
- If using mermaid.live: open the editor, delete sample code, paste the Mermaid code (including the `%%{init:...}%%` block if present) and click "Download" -> choose SVG/PNG.
- If your renderer supports fenced code blocks, paste the code inside a fenced block marked with `mermaid`.

Rendering tips:
- For publication quality, export as SVG. If you need PNG, export at a high DPI (or use SVG -> PNG conversion to control resolution).
- If lines overlap, try switching the flow direction or adding spacing comments (`Note over ...`) to separate elements.
- You can edit participant labels to match any local wording (e.g., change "Server" to "API Server (Express)").

---

## 1) Signup sequence diagram (Mermaid source)

Paste this block into Mermaid Live Editor or Mermaid AI to render the user signup flow.

```mermaid
sequenceDiagram
    autonumber
    participant User as User (Browser)
    participant Client as Next.js Client
    participant Server as Express Server
    participant DB as Postgres DB
    participant Cloud as Cloudinary
    participant Email as Email Service (SMTP)

    User->>Client: Fill signup form (email, password, role, optional file)
    Client->>Server: POST /api/auth/signup (multipart/form-data)
    note right of Server: server validates domain or required file
    Server->>DB: INSERT user row (status: pending_email_verification)

    alt file uploaded (Alumni)
        Server->>Cloud: Upload verification document
        Cloud-->>Server: return file URL
        Server->>DB: UPDATE users SET verification_document_url = file_url
    end

    Server->>Email: Send OTP to user email
    Email-->>User: Deliver OTP email

    User->>Client: Enter OTP
    Client->>Server: POST /api/auth/verify-otp { email, otp }
    Server->>DB: Verify OTP, set users.status = 'active'
    Server-->>Client: 200 OK (optionally return JWT)
    Client-->>User: Show success, redirect to dashboard

    note left of DB: Temporary OTP stored hashed or time-limited

```

Notes for the diagram:
- The `alt` block highlights the conditional path for alumni who upload a verification document. If not an alumnus, the upload + Cloudinary steps are skipped.
- The `autonumber` line adds step numbers; remove it if you prefer no numbers.

---

## 2) College Onboarding sequence diagram (Mermaid source)

Use this block to render the onboarding request and approval flow (requester -> email OTP -> super admin approval).

```mermaid
sequenceDiagram
    autonumber
    participant Requester as Requester (Client)
    participant Server as Express Server
    participant DB as Postgres DB
    participant Email as Email Service (SMTP)
    participant Super as Super Admin

    Requester->>Server: POST /api/onboarding/request-otp { collegeName, contactEmail, domain }
    Server->>DB: INSERT onboarding_request (status: otp_sent)
    Server->>Email: Send onboarding OTP to contactEmail
    Email-->>Requester: Deliver OTP

    Requester->>Server: POST /api/onboarding/verify-otp { requestId, otp }
    Server->>DB: Verify OTP, set onboarding_request.status = 'pending_review'

    Super->>Server: GET /api/admin/onboarding-requests
    Server->>DB: SELECT onboarding_request WHERE status = 'pending_review'
    Super->>Server: POST /api/admin/approve-request { requestId }
    Server->>DB: UPDATE universities SET status = 'active' (create row) 
    Server->>DB: CREATE initial college_admin user for the university
    Server-->>Super: 200 OK (approval confirmed)
    Server->>Email: Notify requester of approval
    Email-->>Requester: Delivery of approval notification

    note right of DB: On approval, optionally seed default departments or send invite links

```

Notes for the diagram:
- If your implementation differs (e.g., additional HOD invitation step), you can insert extra participants and arrows.
---

## 3) Job-apply sequence diagram (Mermaid source)

Use this block to render the typical job-application flow. It covers both internal application storage and external-redirect scenarios.

```mermaid
sequenceDiagram
    autonumber
    participant Student as Student (Browser)
    participant Client as Next.js Client
    participant Server as Express Server
    participant DB as Postgres DB
    participant Company as Company / Recruiter

    Student->>Client: View job listing (GET /api/jobs)
    Client->>Server: GET /api/jobs
    Server->>DB: SELECT jobs (paginated)
    DB-->>Server: return jobs
    Server-->>Client: jobs JSON
    Client-->>Student: Render jobs, user clicks "Apply"

    alt External application link
        Client->>Server: GET /api/jobs/:id (fetch job details)
        Server->>DB: SELECT job where id = :id
        Server-->>Client: job details (includes external_apply_url)
        Client->>Student: Redirect to external_apply_url (opens new tab)
        note right of Company: Candidate applies on external site (outside CareerNest)
    else Internal application (apply within CareerNest)
        Client->>Server: POST /api/jobs/:id/apply { resume_url, cover_letter }
        note right of Server: Authenticate (JWT), validate fields
        Server->>DB: INSERT applications (job_id, user_id, resume_url, status: applied)
        Server->>Company: Notify via email or webhook (optional)
        Server-->>Client: 201 Created (application received)
        Client-->>Student: Show confirmation message
    end

    note left of DB: applications table stores applicant metadata and status

```

Notes for the diagram:
- The diagram shows two common flows: redirecting the user to an external application URL (company careers page) or accepting an application internally and storing it in the `applications` table. Adapt field names to your actual DB schema (e.g., `applications`, `applicants`).
- For internal applications consider adding an application status workflow (received -> reviewed -> shortlisted -> rejected/accepted) and notify applicants via email updates.

---

---

## 3) How to export and include in the report

- Render and export the diagrams as SVG (preferred) or PNG (high DPI). Name files exactly as below and place them under `docs/images/`:
  - `docs/images/sequence-signup.png` (or `.svg`)
  - `docs/images/sequence-onboarding.png` (or `.svg`)

- Insert in your Markdown where noted (Section 4.3 in the report). Example markdown embed:

```markdown
![Figure 4.3: Signup sequence diagram](../images/sequence-signup.png)
Caption: Sequence diagram showing the signup flow including OTP verification and optional alumni document upload.
```

## 4) Optional: Mermaid variants and troubleshooting

- If you prefer a more compact layout, replace `autonumber` with `%%{init: { 'sequence': { 'mirrorActors': false } } }%%` (control visual options) before `sequenceDiagram`.
- For long labels, use short participant aliases and add a longer explanatory caption below the figure in the report.
- If your renderer strips fenced `mermaid` blocks, paste only the inner code (without triple backticks) into mermaid.live or Mermaid AI.

---

If you'd like, I can also:
- Produce the Mermaid ER diagram source generated from `server/db.sql` so you can render the ER directly in mermaid.live.
- Add a third sequence diagram for the job-apply flow.

Which additional diagram should I generate next? (ER from SQL, job-apply sequence, or both?)
