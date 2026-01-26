# Migrations

SQL migrations applied in order by `scripts/migrate.ts`.

Guideline: wrap each migration in `BEGIN; ... COMMIT;` so reruns are safe if the connection drops mid-apply.

Note: `scripts/migrate.ts` tracks applied filenames in `schema_migrations` and will skip already-applied files.
