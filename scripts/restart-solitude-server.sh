#!/usr/bin/env bash
# Restart the Solitude authoritative server for a baseline repetition.
# Exits 0 once a fresh process has been INITIATED; the orchestrator polls
# /health itself, so this must not block waiting for readiness.
#
# NODE is an absolute path on purpose: a non-interactive SSH session does not
# source .bashrc, so nvm's shims are absent. Pinning it also makes the measured
# runtime deterministic instead of dependent on shell initialisation.
set -euo pipefail

NODE="${SOLITUDE_NODE:-$HOME/.nvm/versions/node/v22.23.1/bin/node}"
REPO="${SOLITUDE_REPO:-$HOME/dev/solitude}"
PORT="${SOLITUDE_PORT:-8080}"
LOG="${SOLITUDE_LOG:-/tmp/solitude-server.log}"

# Append rather than truncate: a failure in a later repetition is otherwise
# undiagnosable, because each restart would erase the previous log.

[ -x "$NODE" ] || { echo "node not executable at $NODE" >&2; exit 1; }
[ -f "$REPO/dist/server/main.js" ] || { echo "no server bundle at $REPO/dist/server/main.js" >&2; exit 1; }

pkill -f 'dist/server/main.js' 2>/dev/null || true
for _ in $(seq 1 50); do
  ss -ltn "sport = :${PORT}" 2>/dev/null | grep -q LISTEN || break
  sleep 0.1
done

cd "$REPO"
HOST=0.0.0.0 PORT="$PORT" setsid nohup "$NODE" dist/server/main.js >>"$LOG" 2>&1 &
disown || true

# Fail loudly if the process died immediately, rather than exiting 0 and
# leaving the orchestrator to time out 30s later on a confusing /health wait.
sleep 0.5
pgrep -f 'dist/server/main.js' >/dev/null || {
  echo "server exited immediately; log tail:" >&2
  tail -5 "$LOG" >&2
  exit 1
}
