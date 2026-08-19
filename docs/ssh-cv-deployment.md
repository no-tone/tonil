# Deploying `ssh cv.no-tone.com`

Everything needed to put `apps/ssh-cv` on the internet, and why it is shaped
the way it is.

---

## Why this cannot be a Worker

Every other app in this repo is a Cloudflare Worker. This one cannot be, and
the reason is the *protocol*, not the language - so no amount of Go-on-Workers
tooling changes it.

A Worker is **invoked with a request**. It cannot bind a listening socket, so
it cannot accept a TCP connection on port 22 or perform the server half of an
SSH handshake. Workers do have `connect()`, but it is outbound only.

**Cloudflare Containers don't solve it either.** They have an SSH feature, but
it is for administering your own container:

> SSH does not expose a publicly accessible port on the Container.

The only way in is `wrangler containers ssh <INSTANCE_ID>`, authenticated
against *your* Cloudflare account. Great for debugging, useless for a stranger
typing `ssh cv.no-tone.com`.

**Spectrum can proxy raw TCP**, and SSH is available on Pro and Business (one
app), not Enterprise-only. But Spectrum is a *proxy*, not a host: you still
need a box running the SSH server, and Cloudflare has to be able to route to
it - which rules out a Tailscale CGNAT address, the same wall `/status` hit.
It buys you a hidden origin IP and DDoS absorption. Skip it until you want
those.

So: **a small box with a public IP, and the API stays on Workers.**

---

## Shape

```
your machine                  the box                    Cloudflare
────────────                  ───────                    ──────────
ssh cv.no-tone.com  ──:22──►  ssh-cv (Go)  ──https──►    apps/api
  offers your key               │                        POST /ssh/authorize
                                │  fingerprint only        │
                                │  ◄───────────────────────  allowed + scopes
                                ▼
                          CV          → everyone
                          dotfiles    → allowlisted keys only
```

Your public key never leaves the box. Only the SHA256 fingerprint is sent.

The allowlist lives in a **Worker secret**, so granting or revoking access is
one edit - no Go rebuild, no redeploy, no shell on the box that serves SSH.

---

## This does not use OpenSSH

The obvious design is an OpenSSH account whose login shell is the TUI, locked
down with no sudo and a restricted filesystem. `apps/ssh-cv` does not do that.
It is a **standalone SSH server** (Charm Wish) that speaks the protocol
itself.

That is a meaningful security difference, not a stylistic one:

| | OpenSSH + restricted shell | this |
| --- | --- | --- |
| Unix account for visitors | yes | **none** |
| A shell to escape from | yes, if the TUI ever crashes to one | **none exists** |
| `authorized_keys` on the box | yes, and it is the access model | **no - the API is** |
| Port forwarding, SFTP, `scp` | must be disabled in config | **never implemented** |
| Blast radius of a TUI bug | the restricted account | the process, which owns nothing |

There is no shell behind the TUI because there is no shell at all. A session
is a Go program reading a PTY. `activeterm` middleware also rejects sessions
with no TTY, so `ssh host <command>`, `scp` and port-forward attempts are
refused rather than hanging.

The box's *own* `sshd` - the one you administer it with - is separate, and
step 1 moves it out of the way.

---

## What you need

A very boring machine. 1 vCPU, 512 MB RAM, any Linux. The binary is a few MB
and a session costs almost nothing; ten simultaneous visitors is ten
lightweight goroutine sets in one process, not ten processes.

Which makes **Oracle Cloud Free Tier** the obvious host - see step 0.

---

## 0. The box (Oracle Cloud Free Tier)

Skip this if you already have a VPS; everything below is generic Linux.

### Which shape

| | `VM.Standard.A1.Flex` (Ampere, Arm) | `VM.Standard.E2.1.Micro` (AMD, x86) |
| --- | --- | --- |
| Always Free allowance | 1,500 OCPU-hours + 9,000 GB-hours / month | 2 instances, always |
| Which is 24/7 | **2 OCPU + 12 GB**, as 1 or 2 VMs | 1/8 OCPU + 1 GB each |
| Architecture | `arm64` | `amd64` |

Take the **A1**. Two Arm cores and 12 GB is absurd for this - the process
idles in single-digit megabytes - but it is free, and it leaves room for the
rest of the self-hosted estate on the same box.

The catch is capacity: A1 is the most requested shape Oracle offers and
"Out of host capacity" on launch is normal rather than exceptional. Retry, or
try another availability domain in the region. The E2.1.Micro is the fallback
and is genuinely enough for this service alone; only the build target changes.

### Build for the right architecture

A1 is Arm. Step 3's build line becomes:

```bash
GOOS=linux GOARCH=arm64 bun run build     # A1 (Ampere)
GOOS=linux GOARCH=amd64 bun run build     # E2.1.Micro
```

Nothing else in this document changes - the binary is static and has no
libc or cgo dependency either way.

### ⚠️ Two firewalls, and only one of them is in the console

This is the single thing that wastes the most time on OCI. A port has to be
opened **twice**:

1. **The VCN security list** - Networking → Virtual Cloud Networks → your
   VCN → the subnet's security list → add an ingress rule. Source `0.0.0.0/0`,
   TCP, destination port. This is the layer people find.
2. **The instance's own `iptables`** - Oracle's Ubuntu and Oracle Linux
   images ship with a host firewall that rejects everything except 22,
   *independently* of the console. Opening the port in the console alone
   changes nothing, and there is no error to tell you why.

On Ubuntu images, `ufw` is not what is running - edit
`/etc/iptables/rules.v4` (and `.v6`), or use `iptables -I`:

```bash
sudo iptables -I INPUT 6 -p tcp --dport 2200 -j ACCEPT
sudo netfilter-persistent save
```

`-I` (insert), not `-A` (append), and this is not a style preference. The
chain ends in a blanket `REJECT`, and iptables stops at the first match - an
appended `ACCEPT` sits *after* the reject and is never evaluated. Check where
your reject rule actually is with `sudo iptables -L INPUT --line-numbers` and
insert above it.

On Oracle Linux images it is `firewalld` instead:

```bash
sudo firewall-cmd --permanent --add-port=2200/tcp && sudo firewall-cmd --reload
```

### ⚠️ Do this before step 1, or you will lock yourself out

Step 1 moves your admin `sshd` to port 2200. On OCI, port 2200 is closed in
*both* firewalls by default - so if you move `sshd` first and open the port
second, you have just cut the only way in.

Open 2200 in the security list **and** in `iptables`, confirm with
`nc -vz <public-ip> 2200` from your machine, and only then do step 1. (If it
does happen: the instance console connection in the OCI console is the way
back in, but it is a slow way to learn this.)

### ⚠️ Idle instances get reclaimed

Oracle reclaims Always Free compute that is idle for 7 days, where idle means
95th-percentile CPU **and** network **and** memory (A1 only) all below 20%.

A CV server is idle by definition. This is not a hypothetical risk for this
workload - it is the expected outcome.

The documented fix is to **upgrade the account to Pay As You Go**. Always
Free resources stay free after upgrading; you are billed only for usage above
the Always Free limits, and reclamation stops applying. It requires a card on
file. Do this, rather than running a busy-loop to fake utilisation - that
burns real power to defeat a policy whose whole purpose is to stop exactly
that.

### Can the rest of the self-hosted estate live here too?

Short answer: yes, and it is the reason to take the A1 rather than the micro.
The nine services in `packages/content`'s registry - Tailscale, Nginx,
Portainer, Vaultwarden, Joplin, Immich, OpenCloud, Grafana, Prometheus - fit
inside 2 OCPU / 12 GB without much thought. `ssh-cv` alongside them is noise.

Three real constraints, in the order they will actually bite:

**1. Storage, not CPU.** Always Free gives you 200 GB of block volume total,
across every instance. Immich and OpenCloud are the whole question here: a
photo library and a file share are the two things on that list that grow
without asking. Everything else - Vaultwarden, Joplin, the Prometheus TSDB at
a sane retention, config for the rest - is single-digit GB. Plan the 200 GB as
"about 150 for media, 50 for everything else", and treat object storage or a
different box as the answer when the photos outgrow it, because they will.

**2. Immich wants more than its share.** Transcoding and the ML jobs (face
and object detection) are the only genuinely heavy things on the list.
On 2 Ampere cores they work, but the initial library import will peg the box
for hours and machine learning is best left to run overnight. Its containers
are built for `arm64`, so the A1 is not a problem in itself.

**3. One instance or two.** The 1,500 OCPU-hours are a monthly pool, so
2 OCPU running 24/7 is exactly the budget: you can split it as one 2-core VM
or two 1-core VMs, not both. Prefer **one 2-core VM**. Two 1 GB halves would
put Immich on a core it cannot use and leave nothing spare, and the split
buys nothing - an outage takes the host either way.

Egress is not a constraint: Always Free includes 10 TB/month outbound, which
is more than a personal photo library will move in a year.

What this does *not* solve is that the services are still behind Tailscale
and reachable by IP. Nothing about moving them to Oracle changes the
dashboard's probing model, and the status logic in `apps/api`'s `/status`
route is unaffected.

---

## 1. Move the box's real sshd off port 22

⚠️ **Do this first, and confirm you can still get in before continuing.**
`ssh-cv` wants port 22, and if you take it while your admin `sshd` is on it
you will conflict - possibly locking yourself out.

```bash
sudo sed -i 's/^#*Port 22/Port 2200/' /etc/ssh/sshd_config
sudo systemctl restart ssh
```

Now open a **second terminal** and confirm `ssh -p 2200 box` works. Do not
close the first one until it does.

If the provider has a firewall, open 2200 and keep 22 open. On Oracle
Cloud that means both layers - see step 0, and do it *before* this step.

---

## 2. Secrets on the API

Generate one token. You need the same value in two places.

```bash
openssl rand -hex 32          # copy this
```

Put it on the Worker (run from `apps/api`, not the repo root):

```bash
cd apps/api
read -rs "v?Paste SSH_GATEWAY_TOKEN: " && printf '%s' "$v" | bunx wrangler secret put SSH_GATEWAY_TOKEN && unset v
```

Then the allowlist. Get your fingerprint:

```bash
ssh-keygen -lf ~/.ssh/id_ed25519.pub | awk '{print $2}'
```

```bash
printf '%s' 'SHA256:YOUR_FINGERPRINT laptop dotfiles' | bunx wrangler secret put SSH_AUTHORIZED_KEYS
```

Format is `fingerprint  label  scopes…`, one key per line:

```
SHA256:AbCd…  laptop  dotfiles
SHA256:EfGh…  phone
# comments and blank lines are ignored
```

The label shows in the SSH footer so you can tell which of your machines you
are on. A key with a label but no scopes is *recognised and granted nothing* -
a useful way to name a key without giving it access.

`printf '%s'` rather than `echo`: `echo` appends a newline, which becomes part
of the secret and silently breaks the comparison.

**Without `SSH_GATEWAY_TOKEN` the endpoint refuses everything.** That is
deliberate - an open `/ssh/authorize` would be an oracle for probing which
fingerprints are privileged. A half-configured deploy fails closed.

---

## 3. Build and install

```bash
cd apps/ssh-cv
GOOS=linux GOARCH=arm64 bun run build      # Ampere A1; use amd64 on E2.1.Micro
scp bin/ssh-cv box:/tmp/ssh-cv
```

On the box:

```bash
sudo install -m 755 /tmp/ssh-cv /usr/local/bin/ssh-cv
sudo useradd --system --home /var/lib/ssh-cv --shell /usr/sbin/nologin ssh-cv
sudo mkdir -p /var/lib/ssh-cv
sudo chown ssh-cv:ssh-cv /var/lib/ssh-cv
sudo -u ssh-cv git clone https://github.com/no-tone/dotfiles.git /var/lib/ssh-cv/dotfiles
```

The service account has `nologin` and owns only its own directory. It needs no
privileges - binding port 22 is granted by systemd below rather than by
running as root.

---

## 4. systemd

`/etc/systemd/system/ssh-cv.service`:

```ini
[Unit]
Description=no-tone CV over SSH
After=network-online.target
Wants=network-online.target

[Service]
User=ssh-cv
Group=ssh-cv
WorkingDirectory=/var/lib/ssh-cv

# Never a flag: command-line arguments are visible in `ps` to every user.
Environment=SSH_AUTHORIZE_TOKEN=REPLACE_WITH_THE_TOKEN_FROM_STEP_2

ExecStart=/usr/local/bin/ssh-cv \
  --addr :22 \
  --host-key /var/lib/ssh-cv/host_ed25519 \
  --authorize-url https://api.no-tone.com/ssh/authorize \
  --dotfiles /var/lib/ssh-cv/dotfiles

# Bind :22 without running as root.
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE

# It reads one directory and talks to one API. Nothing else.
NoNewPrivileges=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectSystem=strict
ProtectHome=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictAddressFamilies=AF_INET AF_INET6
RestrictNamespaces=yes
LockPersonality=yes
MemoryDenyWriteExecute=yes
ReadWritePaths=/var/lib/ssh-cv

Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
```

```bash
sudo chmod 600 /etc/systemd/system/ssh-cv.service    # it holds the token
sudo systemctl daemon-reload
sudo systemctl enable --now ssh-cv
sudo journalctl -u ssh-cv -f
```

You should see the listen address and `authorization source: apps/api at …`.

---

## 5. The host key

Generated on first run at `--host-key` and then **never replace it**. It is
the server's identity: change it and every returning visitor's SSH client
prints a large warning about a possible man-in-the-middle.

Back it up:

```bash
sudo cp /var/lib/ssh-cv/host_ed25519 ~/host_ed25519.backup
```

Publish the fingerprint somewhere (the website footer is a good place) so a
first-time visitor can verify it:

```bash
ssh-keygen -lf /var/lib/ssh-cv/host_ed25519.pub
```

---

## 6. DNS

`cv.no-tone.com` → the box's IPv4 (and AAAA if it has one), **grey cloud**.

The orange-cloud proxy is HTTP only; proxying an SSH host through it makes the
name unreachable on 22. Add `dot.no-tone.com` pointing at the same address if
you want both names - SSH has no SNI, so they are the same endpoint either
way, and what you see depends on your key.

---

## 7. Check

```bash
ssh cv.no-tone.com                    # CV, three panes
ssh -o IdentitiesOnly=yes -i /dev/null cv.no-tone.com   # as a stranger: still the CV, no dotfiles tab
ssh pt@cv.no-tone.com                 # opens in Portuguese
```

The username is not identity - anyone can type anything - but it is honoured
as a language preference.

---

## Running it

**Grant a key:** append a line to `SSH_AUTHORIZED_KEYS` and
`wrangler secret put` it again. Takes effect within the authorizer's 60-second
cache. No deploy.

**Revoke a key:** remove its line, put the secret again. Same 60 seconds.

**Update the dotfiles:** `sudo -u ssh-cv git -C /var/lib/ssh-cv/dotfiles pull`.
Read at request time, so no restart.

**Update the CV:** edit `packages/content/src/cv.ts`, `bun run build` in
`apps/ssh-cv`, redeploy the binary. CI fails if the generated JSON has drifted
from the source module.

**If the API is down:** sessions still get the CV. Every authorization failure
resolves to *no scopes*, so an outage costs the dotfiles pane and nothing
else.

---

## Cost

**Nothing**, on Oracle Cloud Free Tier - the Always Free allowance covers this
several times over, and the Pay As You Go upgrade in step 0 stays at zero as
long as usage does. Cloudflare adds nothing either: no Spectrum, no
Enterprise, no Containers.

The box is disposable. The only state on it is the host key, and that is one
file you have a backup of.
