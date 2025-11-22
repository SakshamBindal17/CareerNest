# 7. Deployment & Operations

## 7.1 Deployment Architecture
- Frontend: Deploy `client/` to Vercel (recommended) for Next.js support.
- Backend: Deploy `server/` to Render, Heroku, or a VPS/EC2.
- Database: Use managed PostgreSQL (Heroku Postgres, AWS RDS, Supabase).

## 7.2 Setup and Installation (PowerShell examples)

1) Server

```powershell
cd .\server
npm install
# create .env with required variables (see below)
npm start
```

2) Client

```powershell
cd ..\client
npm install
npm run dev
```

Minimum `.env` for server (do not commit):

- DB_USER, DB_PASSWORD, DB_HOST, DB_NAME, DB_PORT
- JWT_SECRET
- CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

## 7.3 CI/CD and Monitoring
- Add GitHub Actions or Render/Heroku deployment pipelines. Monitor using third-party services or cloud provider tooling.
