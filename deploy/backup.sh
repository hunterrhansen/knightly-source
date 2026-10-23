#!/usr/bin/env bash
# Backs up one environment's database and sends it off the machine: pg_dump (by the app's own
# image, so its pg_dump matches) into data/backups/, then rclone to an S3-compatible bucket
# (Cloudflare R2), keeping 30 days there and 7 days' dumps here. Run nightly by
# knightly-backup.timer. Dumps are named knightly-YYYY-MM-DDTHHMMZ.dump (UTC), so one taken by
# hand before a migration sits beside that night's.
#
#   sudo systemctl start knightly-backup.service    (a dump now, sent off the machine)
#   sudo /opt/knightly/backup.sh production         (the same; reads backup.env itself)
#
# Restore: download a .dump, then pg_restore --clean --if-exists --no-owner -d "$KNIGHTLY_DATABASE_URL" <file>
set -euo pipefail

env="${1:?usage: backup.sh <staging|production>}"
dir="/opt/knightly/$env"
cd "$dir"

docker compose run --rm --no-deps -T worker knightly backup --dir /data/backups --keep 7

# The timer passes backup.env in; run by hand, read it here (it is root's, mode 600).
if [[ -z "${RCLONE_CONFIG_OFFSITE_ACCESS_KEY_ID:-}" && -r /opt/knightly/backup.env ]]; then
  set -a
  # shellcheck source=/dev/null
  . /opt/knightly/backup.env
  set +a
fi
if [[ -z "${RCLONE_CONFIG_OFFSITE_ACCESS_KEY_ID:-}" ]]; then
  if [[ -r /opt/knightly/backup.env ]]; then
    echo "backup.env has no bucket credentials: the dump stays on this machine only." >&2
  else
    echo "Can't read /opt/knightly/backup.env (run with sudo): the dump stays on this machine only." >&2
  fi
  exit 1
fi
# R2 has no object versions, and Ubuntu's rclone (1.60) checks each upload by its version id;
# skipping that check, it trusts the upload's own response (an MD5) instead.
export RCLONE_S3_NO_HEAD=true
# Object-scoped R2 tokens cannot check/create buckets; the bucket is provisioned already.
export RCLONE_S3_NO_CHECK_BUCKET=true
rclone copy "$dir/data/backups" "offsite:${BACKUP_BUCKET:?}/$env" --include "knightly-*.dump"
rclone delete "offsite:${BACKUP_BUCKET}/$env" --min-age 30d --include "knightly-*.dump"
echo "Backed up $env to ${BACKUP_BUCKET}/$env"
