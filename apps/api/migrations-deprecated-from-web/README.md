# Deprecated Web Migrations

These SQL files were generated in the wrong app before database ownership was moved to `apps/api`.

Do not apply them directly.

Use Drizzle migrations generated under `apps/api/drizzle` from the schema in `apps/api/src/db/schema`.
