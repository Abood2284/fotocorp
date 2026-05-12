                         ┌────────────────────┐
                         │      User/Admin     │
                         └─────────┬──────────┘
                                   │
                                   ▼
                         ┌────────────────────┐
                         │      apps/web       │
                         │   Next.js frontend  │
                         │   Vercel/Pages      │
                         └─────────┬──────────┘
                                   │ same-origin/internal API calls
                                   ▼
                         ┌────────────────────┐
                         │      apps/api       │
                         │ Cloudflare Worker   │
                         │ auth + orchestration│
                         └──────┬───────┬─────┘
                                │       │
                                │       ▼
                                │   ┌────────────────────┐
                                │   │   Neon Postgres     │
                                │   │ assets/jobs/users   │
                                │   └────────────────────┘
                                │
                                ▼
                    ┌──────────────────────────┐
                    │ Cloudflare Queue optional │
                    │ message: { jobId }        │
                    └────────────┬─────────────┘
                                 │ HTTP pull / DB polling
                                 ▼
                         ┌────────────────────┐
                         │     apps/jobs       │
                         │ Node + Sharp worker │
                         │ VPS/Docker/server   │
                         └──────┬───────┬─────┘
                                │       │
              reads staging     │       │ writes derivatives
                                ▼       ▼
              ┌────────────────────┐  ┌────────────────────┐
              │ R2 staging bucket   │  │ R2 previews bucket  │
              └────────────────────┘  └────────────────────┘
                                │
                                │ copies approved original
                                ▼
              ┌──────────────────────────────┐
              │ R2 canonical originals bucket │
              │ fotocorp-2026-megafinal       │
              └──────────────────────────────┘