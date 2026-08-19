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

## The wish SCP advisory

`charmbracelet/wish` ships an SCP middleware with an unfixed path traversal.
`fileSystemHandler.prefixed()` cleans the client's path, notices it does not
already start with the configured root, and joins it to the root anyway - so
`../../../etc/passwd` cleans to itself, joins to `/etc/passwd`, and is served.
The same call sits behind the write and mkdir paths, and the filenames come off
the SCP wire through a regex that accepts any string, so it reads *and* writes.

**There is nothing to upgrade to.** The advisory covers everything through
v1.4.7, which is the newest release `go list -m -versions
github.com/charmbracelet/wish` offers, and names the patched version as none.
The v2 line under `charm.land` carries the same code.

**This server is not affected, and the reason is that it never registers the
middleware.** Its middleware stack is `bubbletea`, `activeterm`, `logging` -
there is no file-transfer handler, so there is nothing for a traversal to
traverse. `activeterm` is a second, independent barrier: it rejects any session
without a PTY, which is the shape every SCP session has.

```console
$ ssh -T -p 2222 localhost
Requires an active PTY
```

Both of those are one edit away from stopping being true, and neither edit
would fail to compile or look wrong in review. So `security_test.go` parses
every `.go` file in the module and fails if a `wish/scp` import appears, with
a second test asserting the scan actually reaches `main.go` - a walk that finds
nothing proves nothing.

If file transfer is ever genuinely wanted here, it does not arrive by deleting
that test. It arrives by validating the resolved path against the root in our
own handler, and by writing the advisory's traversal cases as tests that expect
a refusal.

## Running it

Nothing here needs root, a tailnet, or the Oracle box. The CV is embedded in
the binary and the allowlist is a text file, so the whole thing runs on a high
port on your laptop:

```console
$ bun run dev
```

That is the whole command. It generates a throwaway host key, a client key
whose comment grants the `dotfiles` scope, an `authorized_keys` holding it, and
a handful of sample dotfiles - all under `.dev/`, which is gitignored - then
starts the server and prints the line to paste into another terminal:

```console
$ ssh -p 2222 -i .dev/id_ed25519 localhost
```

Two sessions are worth opening, because the difference between them *is* the
authorization model:

```console
$ ssh -p 2222 -i .dev/id_ed25519 localhost      # overview experience skills dotfiles
$ ssh -p 2222 -o IdentitiesOnly=yes localhost   # overview experience skills
```

The second is what everyone else gets: the same CV, no fourth tab, and no
locked door hinting that one exists.

Point `DOTFILES_DIR` at a real checkout to browse that instead of the samples.
One of the samples is called `id_ed25519` on purpose - the reader lists it and
refuses to open it, and seeing that refusal is worth more than reading about it
in the *Dotfiles safety* section above.

### Running the binary directly

`bun run dev` is a convenience, not the interface. The flags are:

```console
$ bun run build                       # regenerates cv.json, then go build
$ ssh-keygen -t ed25519 -f /tmp/k -N "" -C "laptop dotfiles"
$ cp /tmp/k.pub /tmp/authorized_keys  # the pub key line *is* the allowlist entry
$ ./bin/ssh-cv --addr localhost:2222 \
    --host-key /tmp/ssh_cv_host_ed25519 \
    --authorized-keys /tmp/authorized_keys \
    --dotfiles ~/dotfiles
```

If you do, **pass `--host-key` somewhere disposable**. It defaults to
`.ssh/ssh_cv_ed25519` *relative to the working directory* and is generated on
first run, so running from the repo root and from `apps/ssh-cv/` produce two
different server identities and your client warns about a changed host key.
Production wants the opposite: one path, kept forever.

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
