# 3. Requirements and Analysis

## 3.1 Functional Requirements
- User registration and authentication with roles (Student, Alumni, Faculty, College Admin, HOD, Super Admin).
- OTP-based email verification and password reset flows.
- College onboarding flow (request OTP + Super Admin approval) and automated College Admin creation.
- Department and HOD management, with HOD approval for alumni verification.
- Posts (create/read/comment/react), media attachments and feed.
- Job postings scoped to a college and job application flow.
- Private connections and messaging between users.

Concrete functions map to files in the repo: `server/index.js` (endpoints), `server/authMiddleware.js` (auth), `client/components/*` (UI).

## 3.2 Non-functional Requirements
- Security: password hashing (bcrypt), JWT with expiration, role-based access control.
- Performance: paginated endpoints for lists (people, posts, jobs); cache static lists like college list.
- Scalability: stateless backend with shared DB and external storage (Cloudinary/S3).
- Usability: responsive UI using Tailwind CSS.

## 3.3 Use Cases / User Stories
- Student signs up using official college email, verifies OTP, creates profile.
- Alumni signs up and uploads verification documents; HOD reviews and verifies.
- College Admin reviews onboarding requests and adds departments/HODs.
- Employer posts a job scoped to a college; students view and apply.

Include simple user flow diagrams in `docs/images/sequence-signup.png` and `docs/images/sequence-onboarding.png`.
