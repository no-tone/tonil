# ssh-cv

The CV, served over SSH.

```console
$ ssh cv.no-tone.com
```

Anyone can connect. Holders of an allowlisted key additionally get a
read-only dotfiles browser.

## Why this cannot run on Cloudflare Workers

It is the obvious question given the rest of this monorepo, and the answer is
no - not with [`syumai/workers`](https://github.com/syumai/workers), not with
anything.

That project compiles Go to WASM and runs it as a Worker serving **HTTP**. The
problem here is not the language, it is the protocol. A Worker is invoked with
a request; it cannot bind a listening socket, so it cannot accept a TCP
connection on port 22 and cannot perform the server half of an SSH handshake.
Workers do have `connect()`, but that is outbound only.

So this app needs a host with a real IP and port 22: a small VPS, a Fly.io
machine with a raw TCP service, or the tailnet box. **The authorization
endpoint stays on Workers** as part of `apps/api` - which is the useful split,
because it is the part that has to change often.

## The other constraint: SSH has no SNI

TLS sends the hostname, so one IP can serve many domains. SSH does not. The
server never learns whether you typed `cv.no-tone.com` or `dot.no-tone.com`;
if both names resolve to the same address, both are the same connection.

The options are two IPs, two ports (`ssh -p 2222 …`, which nobody wants to
type), or one server that decides from something it *can* see. This takes the
third: **both names point at one server, and your key decides what you get.**

- No key, or an unknown key → the CV. Three panes.
- An allowlisted key with the `dotfiles` scope → the CV *and* a dotfiles pane.

An unauthorized session does not see a locked tab. It sees no tab, because a
visible locked door is an invitation.

The SSH username is not identity - anyone can type anything - but it is
honoured as a language preference, so `ssh pt@cv.no-tone.com` opens in
Portuguese.

## Layout

```
main.go                  wish server, flags, session wiring
internal/cv/             the CV content, generated from packages/content and embedded
internal/authz/          fingerprint → scopes, via apps/api
internal/dotfiles/       filtered, read-only view of a dotfiles checkout
internal/tui/            bubbletea model, panes, dotfiles browser, theme
scripts/generate-content.ts   packages/content → internal/cv/cv.json
```

## Content

`internal/cv/cv.json` is generated from `packages/content/src/cv.ts` - the same
module the website renders - so the two cannot drift. It is committed, so
`go build` works in a checkout with no Bun.

```console
$ bun run generate     # regenerate after editing packages/content/src/cv.ts
```

## Authorization

The allowlist lives in a Worker secret, not in this binary. Access is granted
or revoked by editing one value, with no rebuild and no shell on the SSH host.

`SSH_AUTHORIZED_KEYS` on `apps/api`, one key per line:

```
SHA256:AbCd…  laptop  dotfiles
SHA256:EfGh…  phone
# comments and blank lines are ignored
```

The first field is the fingerprint (`ssh-keygen -lf ~/.ssh/id_ed25519.pub`),
the second a label shown in the UI, and the rest are scopes. A key with no
scopes is recognised but granted nothing.

`SSH_GATEWAY_TOKEN` is a shared secret proving to `apps/api` that a request
came from this server. Without it `/ssh/authorize` refuses everything - an
open endpoint would be an oracle for probing which fingerprints are
privileged.

Every failure - API down, 500, malformed response - resolves to *no scopes*.
An outage costs the dotfiles pane, never the CV, and never grants access.

## Dotfiles safety

Two independent defences, because access control and content filtering fail in
different ways.

**Listing** prefers `git ls-files`. A real checkout accumulates things that are
on disk but deliberately not in the repo - an editor's `node_modules`, a
lockfile, a stray `.DS_Store`. The `.gitignore` is the author's own statement
that those are not part of the dotfiles, and honouring it beats re-deriving
that judgement from filename patterns. On the repo this was built against it
is the difference between **45 files and 3,695**. A non-git root falls back to
a filtered walk.

**Reading** is bounded separately: symlinks are never followed, paths are
re-validated against traversal, anything over 256KB is refused, non-UTF-8 is
refused, and terminal control sequences are stripped so a config file cannot
repaint the viewer's terminal. Filenames matching a credential pattern
(`*.pem`, `id_ed25519`, `*token*`, `*secret*`, …) are listed but never read -
seeing that a file exists while refusing its contents is more honest than
pretending it is not there.

## Running it

```console
# local, with a file instead of the API
$ ssh-keygen -t ed25519 -f /tmp/k -N "" -C "laptop dotfiles"
$ cp /tmp/k.pub /tmp/authorized_keys
$ bun run build
$ ./bin/ssh-cv --addr localhost:2222 \
    --authorized-keys /tmp/authorized_keys \
    --dotfiles ~/dotfiles
$ ssh -p 2222 localhost
```

```console
# production
$ SSH_AUTHORIZE_TOKEN=… ./bin/ssh-cv \
    --addr :22 \
    --host-key /var/lib/ssh-cv/host_ed25519 \
    --authorize-url https://api.no-tone.com/ssh/authorize \
    --dotfiles /var/lib/ssh-cv/dotfiles
```

| flag | env | meaning |
| --- | --- | --- |
| `--addr` | `SSH_ADDR` | listen address (default `:22`) |
| `--host-key` | `SSH_HOST_KEY` | host key path; generated on first run |
| `--dotfiles` | `DOTFILES_DIR` | checkout to browse; empty disables the pane |
| `--authorize-url` | `SSH_AUTHORIZE_URL` | the `apps/api` endpoint |
| - | `SSH_AUTHORIZE_TOKEN` | gateway bearer token (**never a flag** - flags are visible in `ps`) |
| `--authorized-keys` | `SSH_AUTHORIZED_KEYS_FILE` | local allowlist, for dev instead of the API |

The host key is what gives the server its identity. Generate it once and keep
it: replacing it makes every previous visitor's client warn loudly about a
changed key.

## Checks

```console
$ bun run check-types   # gofmt -l + go vet
$ bun run test          # go test ./...
```
