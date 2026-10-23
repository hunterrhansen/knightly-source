---
name: deploy-backend
description: Deploy the Knightly backend image (and, for staging, the Expo web export) to staging and then production. Use when asked to deploy, ship to staging/production, roll back, or update staging.knightlychess.app.
---

# Deploy the backend

`docs/deploy.md` is the source of truth (§9 Deploying, the by-hand procedure and
the staging web export). Re-read it before every deploy; this skill is the order
of operations. Deploying is outward-facing: confirm the commit and target with
the user before each environment.

1. Pick the merged `main` commit. Check what each environment runs:
   `KNIGHTLY_IMAGE_TAG` in `/opt/knightly/{staging,production}/.env` on the VM.
2. Gates: check whether Quality succeeded for that commit
   (`docs/runtime-verification.md#ci-and-pre-push`). If CI cannot run, run the
   `verify-before-pr` gates locally on that exact commit first.
3. Before a data-changing migration, take a fresh production dump (`docs/deploy.md`).
4. Staging first, always:
   - With GitHub Actions working: Deploy runs after Quality on `main`.
   - Otherwise: follow **Deploying by hand** in `docs/deploy.md` (build the
     image on the VM from `git archive`, run `deploy/deploy.sh` with
     `TARGET=staging`).
   - If app code changed, update the staging Expo web export
     (**Staging web export** in `docs/deploy.md`; always pass `--clear`).
5. Check staging: `curl -s https://staging.knightlychess.app/api/health`, then
   the affected screens.
6. Production gets the exact staging-tested `sha-<commit>` tag (Actions › Deploy ›
   Run workflow, or the by-hand script with `TARGET=production`). Nothing is rebuilt.
7. Rollback is the same deploy with an older staging-tested tag.

Afterwards update `docs/status.md` (what is deployed where) in the same change as
any other doc updates.
