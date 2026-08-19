// Command ssh-cv serves a CV - and, for authorized keys, a dotfiles browser -
// over SSH.
//
//	ssh cv.no-tone.com
//
// One caveat shapes the whole design: SSH has no SNI. The client never tells
// the server which hostname it dialled, so `cv.no-tone.com` and
// `dot.no-tone.com` pointing at the same address are indistinguishable here.
// Rather than split them across ports (`ssh -p 2222` is not a thing anyone
// wants to type) both names resolve to this one server, and what you see
// depends on your key: everyone gets the CV, authorized keys additionally get
// a dotfiles tab. See README.md.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/ssh"
	"github.com/charmbracelet/wish"
	"github.com/charmbracelet/wish/activeterm"
	"github.com/charmbracelet/wish/bubbletea"
	"github.com/charmbracelet/wish/logging"
	gossh "golang.org/x/crypto/ssh"

	"github.com/no-tone/tonil/apps/ssh-cv/internal/authz"
	"github.com/no-tone/tonil/apps/ssh-cv/internal/cv"
	"github.com/no-tone/tonil/apps/ssh-cv/internal/tui"
)

// contextKey is unexported so nothing outside this package can collide with
// it in the session context.
type contextKey string

const grantKey contextKey = "tonil.grant"
const fingerprintKey contextKey = "tonil.fingerprint"

type config struct {
	addr           string
	hostKeyPath    string
	dotfilesRoot   string
	authorizeURL   string
	authorizeToken string
	authorizedKeys string
	idleTimeout    time.Duration
	maxTimeout     time.Duration
}

func envOr(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

func parseFlags() config {
	var cfg config
	flag.StringVar(&cfg.addr, "addr", envOr("SSH_ADDR", ":22"),
		"address to listen on")
	flag.StringVar(&cfg.hostKeyPath, "host-key", envOr("SSH_HOST_KEY", ".ssh/ssh_cv_ed25519"),
		"path to the host key; generated on first run if absent")
	flag.StringVar(&cfg.dotfilesRoot, "dotfiles", os.Getenv("DOTFILES_DIR"),
		"directory holding the dotfiles checkout; empty disables the pane")
	flag.StringVar(&cfg.authorizeURL, "authorize-url", os.Getenv("SSH_AUTHORIZE_URL"),
		"apps/api endpoint that resolves a key fingerprint to a grant")
	flag.StringVar(&cfg.authorizedKeys, "authorized-keys", os.Getenv("SSH_AUTHORIZED_KEYS_FILE"),
		"local authorized_keys file to use instead of the API (for local dev)")
	flag.DurationVar(&cfg.idleTimeout, "idle-timeout", 5*time.Minute,
		"disconnect a session after this long with no activity")
	flag.DurationVar(&cfg.maxTimeout, "max-timeout", 30*time.Minute,
		"hard cap on session duration")
	flag.Parse()

	// Never a flag: a token on the command line is visible in `ps` to every
	// user on the box.
	cfg.authorizeToken = os.Getenv("SSH_AUTHORIZE_TOKEN")
	return cfg
}

func buildAuthorizer(cfg config) (authz.Authorizer, string, error) {
	if cfg.authorizedKeys != "" {
		data, err := os.ReadFile(cfg.authorizedKeys)
		if err != nil {
			return nil, "", fmt.Errorf("read %s: %w", cfg.authorizedKeys, err)
		}
		grants, err := authz.ParseAuthorizedKeys(data)
		if err != nil {
			return nil, "", err
		}
		return authz.StaticAuthorizer{Grants: grants},
			fmt.Sprintf("local authorized_keys (%d keys)", len(grants)), nil
	}

	if cfg.authorizeURL != "" {
		if cfg.authorizeToken == "" {
			// Without the token the API cannot tell this server from anyone
			// else who found the endpoint, which turns the allowlist into an
			// oracle. Refuse rather than run in a weaker mode than intended.
			return nil, "", errors.New(
				"SSH_AUTHORIZE_TOKEN is required when --authorize-url is set")
		}
		return &authz.APIAuthorizer{
			Endpoint: cfg.authorizeURL,
			Token:    cfg.authorizeToken,
			Client:   &http.Client{Timeout: 5 * time.Second},
		}, "apps/api at " + cfg.authorizeURL, nil
	}

	return authz.Denier{}, "none - the CV is public, dotfiles are disabled", nil
}

func main() {
	cfg := parseFlags()

	content, langs, err := cv.Load()
	if err != nil {
		log.Fatalf("ssh-cv: %v", err)
	}

	authorizer, source, err := buildAuthorizer(cfg)
	if err != nil {
		log.Fatalf("ssh-cv: %v", err)
	}

	if cfg.dotfilesRoot != "" {
		if info, statErr := os.Stat(cfg.dotfilesRoot); statErr != nil || !info.IsDir() {
			log.Printf("ssh-cv: dotfiles dir %q unreadable, disabling that pane", cfg.dotfilesRoot)
			cfg.dotfilesRoot = ""
		}
	}

	server, err := wish.NewServer(
		wish.WithAddress(cfg.addr),
		wish.WithHostKeyPath(cfg.hostKeyPath),
		wish.WithIdleTimeout(cfg.idleTimeout),
		wish.WithMaxTimeout(cfg.maxTimeout),

		// Accept every key, then decide what it may see. Refusing unknown
		// keys at the handshake would make the CV private, which defeats the
		// point - the whole appeal is that `ssh cv.no-tone.com` just works.
		wish.WithPublicKeyAuth(func(ctx ssh.Context, key ssh.PublicKey) bool {
			fingerprint := authz.Fingerprint(key)
			ctx.SetValue(fingerprintKey, fingerprint)
			ctx.SetValue(grantKey, authorizer.Authorize(ctx, fingerprint))
			return true
		}),
		// Keyboard-interactive with no prompts lets a client that offers no
		// key connect anyway, and get the public CV.
		wish.WithKeyboardInteractiveAuth(func(ssh.Context, gossh.KeyboardInteractiveChallenge) bool {
			return true
		}),

		wish.WithMiddleware(
			bubbletea.Middleware(func(s ssh.Session) (tea.Model, []tea.ProgramOption) {
				return newSession(s, content, langs, cfg.dotfilesRoot)
			}),
			// Reject sessions with no PTY (`ssh host command`, scp, port
			// forwards): a Bubble Tea program needs a terminal, and without
			// this they hang instead of failing.
			activeterm.Middleware(),
			logging.Middleware(),
		),
	)
	if err != nil {
		log.Fatalf("ssh-cv: build server: %v", err)
	}

	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)

	log.Printf("ssh-cv: listening on %s", cfg.addr)
	log.Printf("ssh-cv: authorization source: %s", source)
	if cfg.dotfilesRoot != "" {
		log.Printf("ssh-cv: dotfiles from %s", cfg.dotfilesRoot)
	}

	go func() {
		if err := server.ListenAndServe(); err != nil &&
			!errors.Is(err, ssh.ErrServerClosed) {
			log.Fatalf("ssh-cv: serve: %v", err)
		}
	}()

	<-done
	log.Print("ssh-cv: shutting down")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil &&
		!errors.Is(err, ssh.ErrServerClosed) {
		log.Printf("ssh-cv: shutdown: %v", err)
	}
}

func newSession(
	s ssh.Session,
	content map[string]cv.Content,
	langs []string,
	dotfilesRoot string,
) (tea.Model, []tea.ProgramOption) {
	pty, _, _ := s.Pty()

	grant, _ := s.Context().Value(grantKey).(authz.Grant)
	fingerprint, _ := s.Context().Value(fingerprintKey).(string)

	// The SSH username is not an identity here - anyone can type anything -
	// but `ssh pt@cv.no-tone.com` is a pleasant way to land in Portuguese,
	// so it is honoured as a preference and nothing more.
	ordered := langs
	if requested := strings.ToLower(s.User()); requested != "" {
		for i, lang := range langs {
			if lang == requested && i != 0 {
				ordered = append([]string{lang}, append(
					append([]string{}, langs[:i]...), langs[i+1:]...)...)
				break
			}
		}
	}

	model := tui.New(tui.Config{
		Content:      content,
		Langs:        ordered,
		Grant:        grant,
		DotfilesRoot: dotfilesRoot,
		Width:        pty.Window.Width,
		Height:       pty.Window.Height,
		Fingerprint:  fingerprint,
	})
	return model, []tea.ProgramOption{tea.WithAltScreen()}
}
