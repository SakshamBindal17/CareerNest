# 10. User Manual / Demo Guide

## How to run locally

1) Start the server

```powershell
cd .\server
npm install
# create .env with required variables
npm start
```

2) Start the client

```powershell
cd ..\client
npm install
npm run dev
```

Open `http://localhost:3000`.

## Demo script for evaluators
1. Sign up as a Student using `user@college.edu` (matching `college_domains`).
2. Verify OTP received by email.
3. As a Super Admin (or by inserting a row in `universities`), test onboarding request flows.
4. As College Admin, add department and invite HOD.
5. Create a job posting and view it in jobs feed.

## Screenshots to include
- `docs/images/screenshot-home.png` — landing page
- `docs/images/screenshot-signup.png` — sign up flow
- `docs/images/screenshot-profile.png` — user profile page
- `docs/images/screenshot-job-post.png` — job posting form

For each screenshot, include a short caption and place it in the appropriate section (e.g., signup screenshot in Section 5 or 10).
