# Vercel deployment and database setup

This project now uses the Neon PostgreSQL serverless driver. The database URL is read only from the server-side `DATABASE_URL` environment variable. The API creates its two tables on the first request.

## Connect the database

1. Import this GitHub repository into Vercel as a Next.js project.
2. In the Vercel project, install a Neon Postgres resource from Marketplace and connect it to Production (and Preview if needed). Confirm that the integration provides `DATABASE_URL`.
3. Deploy. The first board API request creates `daily_observations` and `board_observations` automatically.

Do not put a database connection string in source code, `NEXT_PUBLIC_*`, or a committed file. `.env.local` is ignored by Git.

## Keep the two existing actual records

The current public Site still stores its records in its existing Cloudflare D1 database. A new Vercel database starts empty, so export and import the two live records once before switching the submission URL:

1. On the current board, select the live records tab and use **JSON 내보내기**. Keep the downloaded `t04-real-records.json` locally; do not commit it.
2. In the local project, run `vercel env pull .env.local` after linking the Vercel project and connecting Neon.
3. With Node.js 22 or later, run `node --env-file=.env.local scripts/import-real-records.mjs ./t04-real-records.json`.
4. Deploy or redeploy, open the Vercel URL, and verify both dates and their values before using it as the submission URL.

The import script accepts only a live Asia/Seoul board export and at most two rows. It imports the source details, raw values, lock state, and board status. It is intended for the first migration into the new database.
