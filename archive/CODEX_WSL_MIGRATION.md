# Preserve Codex history across devcontainer rebuilds

> [!NOTE]
> This is an archived migration record. The migration was completed in July
> 2026. It includes the corrections learned while recovering history that the
> VS Code Codex extension initially failed to display.

This procedure moves a devcontainer's Codex state into WSL and bind-mounts it
back into future containers. After migration, WSL's `~/.codex` is the single
source of truth.

Codex stores more than transcripts there: configuration, authentication,
session files and indexes, SQLite databases, memories, skills, and plugins.
Copy the whole directory, not only `history.jsonl` or `sessions/`.

## Critical lesson: preserve the absolute Codex home path

Codex's `state_5.sqlite` database stores absolute paths in
`threads.rollout_path`. Mounting the same directory at different paths does
not make those database values portable.

For example, this configuration looked reasonable but caused the VS Code
extension to show no history:

```json
"mounts": [
  "source=${localEnv:HOME}/.codex,target=/codex-home,type=bind"
],
"containerEnv": {
  "CODEX_HOME": "/codex-home"
}
```

The CLI could still find sessions by scanning the directory, but the extension
used the database, rejected paths such as `/home/daniel/.codex/sessions/...`
as missing inside the container, and logged:

```text
state db list_threads returned stale rollout path ...
state db discrepancy during list_threads_db: stale_db_path_dropped
```

Use the same absolute Codex home in WSL and every container. On this machine,
that path is `/home/daniel/.codex`, even though the container user is `node`.
Both users have UID 1000, so ownership remains compatible.

## 1. Stop the original container

Run all migration commands from a normal WSL terminal:

```bash
cd ~/dev/solitude
docker ps --format 'table {{.ID}}\t{{.Names}}\t{{.Mounts}}'
```

Exit active Codex sessions, close the VS Code devcontainer window, and stop
the container after substituting its ID:

```bash
CID=put-the-container-id-here
docker stop "$CID"
```

Do not rebuild or remove it yet. A stopped container remains usable with
`docker cp` and is the primary recovery source until migration is verified.

## 2. Copy the complete Codex home into WSL

The original container used `/home/node/.codex`. Preserve any existing WSL
state rather than merging live SQLite databases by hand:

```bash
stamp="$(date +%Y%m%d-%H%M%S)"

if [ -e "$HOME/.codex" ]; then
    mv "$HOME/.codex" "$HOME/.codex.before-migration-$stamp"
fi

stage="$(mktemp -d)"
docker cp "$CID":/home/node/.codex "$stage/"
mv "$stage/.codex" "$HOME/.codex"
rmdir "$stage"

sudo chown -R "$(id -u):$(id -g)" "$HOME/.codex"
chmod 700 "$HOME/.codex"
rm -f "$HOME/.codex/ipc/ipc.sock"
```

Create a credential-sensitive recovery archive before rebuilding:

```bash
tar \
  --exclude='.codex/ipc/*.sock' \
  -C "$HOME" \
  -czf "$HOME/codex-migration-$stamp.tar.gz" \
  .codex

chmod 600 "$HOME/codex-migration-$stamp.tar.gz"
```

The archive contains `auth.json`. Do not commit, upload, or share it.

Verify the copy:

```bash
du -sh "$HOME/.codex"
test -f "$HOME/.codex/history.jsonl" && echo "History found"
test -d "$HOME/.codex/sessions" && echo "Sessions found"
find "$HOME/.codex/sessions" -type f | wc -l
```

At migration time, the source used about 402 MB.

## 3. Configure one canonical path

Use the WSL absolute path as both the bind-mount target and `CODEX_HOME`:

```json
{
  "name": "Solitude",
  "image": "mcr.microsoft.com/devcontainers/typescript-node:4-22-trixie",
  "mounts": [
    "source=${localEnv:HOME}/.codex,target=/home/daniel/.codex,type=bind"
  ],
  "containerEnv": {
    "CODEX_HOME": "/home/daniel/.codex"
  }
}
```

`${localEnv:HOME}` must resolve in WSL rather than Windows. Open the repository
from WSL so Dev Containers runs in that context:

```bash
cd ~/dev/solitude
code .
```

Confirm that `$HOME/.codex` exists before rebuilding. Docker may otherwise
create an empty, root-owned bind source.

## 4. Account for paths from the original container

Immediately after copying, some database rows may still refer to the original
`/home/node/.codex` path. A temporary compatibility mount can keep those rows
readable while Codex reindexes them:

```json
"mounts": [
  "source=${localEnv:HOME}/.codex,target=/home/daniel/.codex,type=bind",
  "source=${localEnv:HOME}/.codex,target=/home/node/.codex,type=bind"
],
"containerEnv": {
  "CODEX_HOME": "/home/daniel/.codex"
}
```

Keep the canonical `CODEX_HOME` set to `/home/daniel/.codex`. The second mount
is only an alias for old absolute database paths; remove it after auditing the
database as described below.

If an incorrect intermediate path such as `/codex-home` was already used, add
the same temporary alias for it as well:

```json
"source=${localEnv:HOME}/.codex,target=/codex-home,type=bind"
```

Do not make the compatibility path canonical. Once Codex has rewritten those
rows, remove the extra mount.

## 5. Verify the rebuilt container

Inside the container:

```bash
echo "$CODEX_HOME"
findmnt -T "$CODEX_HOME"
stat -c 'owner=%u:%g path=%n' "$CODEX_HOME"
test -f "$CODEX_HOME/history.jsonl" && echo "History available"
test -d "$CODEX_HOME/sessions" && echo "Sessions available"
```

Expected results:

- `CODEX_HOME` is `/home/daniel/.codex`.
- `findmnt` reports the WSL `~/.codex` bind mount.
- The container user can read and write the mounted directory.
- The session files exist.

Check discovery independently of the extension UI:

```bash
/home/node/.vscode-server/extensions/openai.chatgpt-*/bin/linux-x86_64/codex resume --all
```

The picker can initially display `0 / 0` while loading. In this migration it
took roughly 10-15 seconds before the recovered sessions appeared.

## 6. Audit absolute paths before removing compatibility mounts

The `sqlite3` CLI may not be installed. Node 22's built-in SQLite API can audit
the database read-only:

```bash
node -e '
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync(process.env.CODEX_HOME + "/state_5.sqlite", {
  readOnly: true,
});
const rows = db.prepare("select rollout_path from threads").all();
const counts = new Map();
for (const { rollout_path: path } of rows) {
  const prefix = path.replace(/\/(sessions|archived_sessions)\/.*$/, "");
  const value = counts.get(prefix) || { total: 0, missing: 0 };
  value.total += 1;
  if (!fs.existsSync(path)) value.missing += 1;
  counts.set(prefix, value);
}
console.log(Object.fromEntries(counts));
db.close();
'
```

Remove a compatibility mount only when its prefix has zero database rows. At
the end of this recovery, 57 of 60 rows used `/home/daniel/.codex`, none used
`/codex-home`, and three older rows still used `/home/node/.codex` even though
their files existed at the canonical location.

## Recovery and diagnosis

If the extension shows no conversations:

1. Stop Codex before changing mounts or databases.
2. Verify the bind source and effective container mounts:

   ```bash
   ls -la "$HOME/.codex"
   docker inspect "$CID" --format '{{json .Mounts}}'
   ```

3. Run `codex resume --all`. If the CLI sees sessions but the extension does
   not, inspect **Output > Codex** for `stale_db_path_dropped` warnings.
4. Compare the warned prefix with the actual `CODEX_HOME` and add a temporary
   compatibility mount if necessary.
5. Audit `threads.rollout_path` before removing that alias.

Generic `fs/readFile` errors saying `No such file or directory` can accompany
the stale database paths. Authentication errors such as `/settings/user` 403
and warnings about ignored experimental configuration keys were also present,
but they were not the cause of missing local history.

The original stopped container remains recoverable until removed. Additional
recovery sources are the timestamped `codex-migration-*.tar.gz` archive and any
`~/.codex.before-migration-<timestamp>` directory.

## Operational cautions

- Keep Codex versions reasonably aligned across WSL and containers.
- Avoid opening or modifying the same active conversation from multiple
  environments simultaneously.
- Preserve the canonical absolute `CODEX_HOME` in every future container.
- Treat Codex archives as credentials because they contain `auth.json`.

## References

- [VS Code: Add another local file mount](https://code.visualstudio.com/remote/advancedcontainers/add-local-file-mount)
- [VS Code: Add a non-root user to a container](https://code.visualstudio.com/remote/advancedcontainers/add-nonroot-user)
