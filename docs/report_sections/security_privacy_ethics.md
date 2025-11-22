# 8. Security, Privacy & Ethics

## Authentication & Authorization
- Passwords hashed with bcrypt.
- JWT tokens with expiry; `server/authMiddleware.js` validates and attaches `req.user`.
- Role-based checks: `isCollegeAdmin`, `isHODorAdmin` wrappers are used in protected routes.

## Sensitive Data & Document Handling
- Alumni verification documents are stored in Cloudinary (or S3) and access is mediated via HOD endpoints which return signed or proxied URLs.
- Ensure production storage access keys are not embedded in the codebase and rotate keys periodically.

## Privacy & Ethics
- Minimize personal data retention when possible; remove temporary files under `temp/` after upload.
- Only authorized roles may access sensitive documents.
- Add a clear privacy policy and data retention policy if deploying publicly.
