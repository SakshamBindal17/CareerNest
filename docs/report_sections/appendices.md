# Appendices

## Appendix A — Database schema (excerpt)
Paste the SQL schema from `server/db.sql` or include an excerpt here. Example:

```sql
CREATE TABLE universities (
  university_id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  admin_name VARCHAR(255) NOT NULL,
  admin_email VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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

## Appendix B — API Reference (compact)
Include a two-column table (endpoint / purpose) or paste the compact table from the template.

## Appendix C — Configuration examples
Example `.env` (do NOT commit):

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
STORAGE_PROVIDER=cloudinary
```

## Appendix D — Test logs
Paste test run logs or CI output screenshots in `docs/images/tests/`.
