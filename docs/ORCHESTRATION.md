# Orchestration Manual

How this project is built by an orchestrating AI agent delegating to subagents.
Read this together with `STATUS.md` (live progress) and `docs/SPEC.md` (what to build)
before resuming work in a new session.

## Principle

The lead agent (orchestrator) does **minimum reading and writing itself**. It only:

- routes work to subagents and defines their scope,
- reviews results between stages,
- performs the Render deployment via the Render MCP tools,
- keeps `STATUS.md` up to date at every significant milestone.

All substantial reading (the plan, the codebase) and writing (code, docs) is done by
subagents.

## Roles

| Role | Model | Scope | Deliverable |
|---|---|---|---|
| Spec Analyst | `composer-2.5-fast` | Read `docs/civic-platform-implementation-plan.html`, resolve ambiguities as explicit `DECISION:` notes | `docs/SPEC.md` |
| Builder | `cursor-grok-4.5-high` | Implement the MVP per `docs/SPEC.md`; small focused git commits; must run/build/verify locally | Working app, clean commit series |
| Docs & Release | `composer-2.5-fast` | README (what it is / how to use / how to deploy), `.env.example`, `docs/SECRETS.md` (where to obtain and manage each credential) | Docs committed; repo pushed to origin |
| Orchestrator | (lead session) | Everything in "Principle" above; Render deploy + live verification | Deployed service, updated `STATUS.md` |

## Workflow (stages, in order)

1. **Spec** — Spec Analyst distills the HTML plan into `docs/SPEC.md`. Done once;
   re-run only if the plan document changes.
2. **Build** — Builder implements per SPEC.md. Requirements for the Builder prompt:
   - degrade gracefully when third-party keys (Turnstile, Access, R2, email) are
     absent, so the service can boot and deploy before credentials exist;
   - bind `0.0.0.0:$PORT`; SQLite on a persistent disk path from env;
   - clean git history: scaffold → schema/migrations → features → tests, one
     concern per commit; no giant "implement everything" commit.
3. **Docs** — Docs & Release writes README, `.env.example` (every variable with a
   comment), and `docs/SECRETS.md` (per credential: what it is, where to obtain it,
   where it is managed, rotation notes). Then pushes `main` to
   `https://github.com/skad0/agree.git`.
4. **Deploy** — Orchestrator creates/updates the Render web service from the GitHub
   repo via Render MCP (persistent disk mounted for SQLite, env vars set,
   single instance), triggers deploy, checks logs, and verifies the live URL.
5. **Verify & close** — smoke-test core flows, update `STATUS.md`, report the live
   URL and any credentials still needed from the user.

## Rules

- One stage at a time; do not start Build before SPEC.md exists, or Deploy before
  the repo is pushed.
- Every subagent prompt must be self-contained: repo path, relevant file paths,
  exact deliverables, and the requirement to report back what was done and any errors.
- Subagents commit their own work; the orchestrator never leaves uncommitted changes
  at the end of a session.
- `STATUS.md` is the single source of truth for progress. Update it before ending
  any session: completed / in progress / remaining / decisions / blockers.
- Secrets never go into the repo — only `.env.example` placeholders and
  `docs/SECRETS.md` instructions.

## Known environment issues

- On the original Windows machine the orchestrator's own shell returned no output;
  git and build commands had to be run by shell subagents (unsandboxed). May not
  apply on other machines — test with a trivial command first.
