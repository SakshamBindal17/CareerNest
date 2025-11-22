# 6. Testing

## 6.1 Test Strategy
- Manual functional testing for core flows: signup, OTP verification, onboarding, HOD approvals, job posting.
- Suggested automated testing: unit tests for helpers, integration tests for API endpoints using Supertest, E2E tests with Playwright.

## 6.2 Test Cases and Results

Sample test case — Signup + Verify OTP
- Input: POST `/api/auth/signup` with role=Student, email=user@college.edu
- Expected: 200 OK and OTP sent; DB entry with `pending_email_verification`.

Record actual manual test results and paste screenshots to `docs/images/tests/`.

## 6.3 Bug Tracking
- Document any bugs found and the fixes. Use a simple table listing bug, steps to reproduce, commit/PR that fixed it.
