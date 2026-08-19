package dotfiles

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func fixture(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	write := func(rel, body string) {
		t.Helper()
		full := filepath.Join(root, filepath.FromSlash(rel))
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(full, []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	write("README.md", "# dotfiles\n")
	write("zsh/.zshrc", "export EDITOR=nvim\n")
	write("git/.gitconfig", "[user]\n\tname = t\n")
	write(".git/config", "[remote \"origin\"]\n")
	write("secrets/id_ed25519", "PRIVATE KEY MATERIAL")
	write("aws/credentials", "aws_secret_access_key = hunter2")
	write("app/npm-token.txt", "npm_abc123")
	write("certs/server.pem", "-----BEGIN CERTIFICATE-----")
	write("bin/blob", "\x00\x01\x02\x03binary")
	return root
}

func TestIsSensitive(t *testing.T) {
	sensitive := []string{
		".env", ".ENV", ".netrc", "id_rsa", "id_ed25519", "credentials",
		"server.pem", "key.p12", "backup.kdbx", "npm-token.txt",
		"aws-credentials", "my.secret.yml", "PASSWORD.txt", "private-key.txt",
		"authorized_keys",
	}
	for _, name := range sensitive {
		if !IsSensitive(name) {
			t.Errorf("IsSensitive(%q) = false, want true", name)
		}
	}

	safe := []string{
		".zshrc", ".gitconfig", "README.md", "bootstrap.sh", "manifest.jsonc",
		"starship.toml", "Main.ps1",
	}
	for _, name := range safe {
		if IsSensitive(name) {
			t.Errorf("IsSensitive(%q) = true, want false", name)
		}
	}
}

func TestTreeSkipsGitAndMarksSensitive(t *testing.T) {
	root := fixture(t)
	listing, err := Tree(root)
	if err != nil {
		t.Fatalf("Tree() error = %v", err)
	}

	byPath := map[string]Entry{}
	for _, e := range listing.Entries {
		byPath[e.Path] = e
		if strings.HasPrefix(e.Path, ".git/") || e.Path == ".git" {
			t.Errorf("tree exposed a .git entry: %s", e.Path)
		}
	}

	if _, ok := byPath["zsh/.zshrc"]; !ok {
		t.Error("expected zsh/.zshrc in tree")
	}
	for _, secret := range []string{
		"secrets/id_ed25519", "aws/credentials", "app/npm-token.txt", "certs/server.pem",
	} {
		entry, ok := byPath[secret]
		if !ok {
			t.Errorf("expected %s to be listed", secret)
			continue
		}
		if !entry.Sensitive {
			t.Errorf("%s should be marked sensitive", secret)
		}
	}
}

func TestTreeSortsDirectoriesFirst(t *testing.T) {
	root := fixture(t)
	listing, err := Tree(root)
	if err != nil {
		t.Fatal(err)
	}
	// Within the top level, every directory must precede every file.
	seenFile := false
	for _, e := range listing.Entries {
		if strings.Contains(e.Path, "/") {
			continue
		}
		if !e.IsDir {
			seenFile = true
		} else if seenFile {
			t.Errorf("directory %s sorted after a file", e.Path)
		}
	}
}

func TestReadReturnsText(t *testing.T) {
	root := fixture(t)
	body, err := Read(root, "zsh/.zshrc")
	if err != nil {
		t.Fatalf("Read() error = %v", err)
	}
	if body != "export EDITOR=nvim\n" {
		t.Errorf("Read() = %q", body)
	}
}

func TestReadRefusesSensitiveFiles(t *testing.T) {
	root := fixture(t)
	for _, secret := range []string{
		"secrets/id_ed25519", "aws/credentials", "app/npm-token.txt", "certs/server.pem",
	} {
		body, err := Read(root, secret)
		if !errors.Is(err, ErrNotFound) {
			t.Errorf("Read(%q) err = %v, want ErrNotFound", secret, err)
		}
		if body != "" {
			t.Errorf("Read(%q) leaked %d bytes", secret, len(body))
		}
	}
}

func TestReadRefusesGit(t *testing.T) {
	root := fixture(t)
	if _, err := Read(root, ".git/config"); !errors.Is(err, ErrNotFound) {
		t.Errorf("Read(.git/config) err = %v, want ErrNotFound", err)
	}
}

func TestReadRefusesTraversal(t *testing.T) {
	root := fixture(t)
	outside := filepath.Join(filepath.Dir(root), "outside.txt")
	if err := os.WriteFile(outside, []byte("do not serve this"), 0o644); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Remove(outside) })

	escapes := []string{
		"../outside.txt",
		"../../etc/passwd",
		"zsh/../../outside.txt",
		"/etc/passwd",
		"./../outside.txt",
		"zsh/../../../etc/passwd",
	}
	for _, attempt := range escapes {
		body, err := Read(root, attempt)
		if err == nil {
			t.Errorf("Read(%q) unexpectedly succeeded with %d bytes", attempt, len(body))
		}
		if strings.Contains(body, "do not serve") || strings.Contains(body, "root:") {
			t.Errorf("Read(%q) escaped the root", attempt)
		}
	}
}

func TestReadRefusesBinary(t *testing.T) {
	root := fixture(t)
	// The fixture writes valid UTF-8 with NUL bytes, which is text by
	// utf8.Valid but must still not reach a terminal intact.
	body, err := Read(root, "bin/blob")
	if err != nil {
		return // rejected outright, also fine
	}
	if strings.ContainsAny(body, "\x00\x01\x02\x03") {
		t.Errorf("control bytes survived sanitisation: %q", body)
	}
}

func TestReadStripsTerminalEscapes(t *testing.T) {
	root := t.TempDir()
	// An escape sequence in a config file would otherwise be executed by the
	// viewer's terminal - this one clears the screen and moves the cursor.
	hostile := "safe\x1b[2J\x1b[Hstill safe\ttabbed\n"
	if err := os.WriteFile(filepath.Join(root, "notes.txt"), []byte(hostile), 0o644); err != nil {
		t.Fatal(err)
	}
	body, err := Read(root, "notes.txt")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(body, "\x1b") {
		t.Errorf("escape character survived: %q", body)
	}
	if !strings.Contains(body, "\t") || !strings.HasSuffix(body, "\n") {
		t.Errorf("tab/newline should be preserved, got %q", body)
	}
}

func TestReadRejectsOversizeFiles(t *testing.T) {
	root := t.TempDir()
	big := strings.Repeat("x", MaxFileBytes+1)
	if err := os.WriteFile(filepath.Join(root, "big.txt"), []byte(big), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := Read(root, "big.txt"); err == nil {
		t.Error("expected an error for an oversize file")
	}
}

func TestReadRefusesSymlinks(t *testing.T) {
	root := t.TempDir()
	target := filepath.Join(filepath.Dir(root), "linked-secret.txt")
	if err := os.WriteFile(target, []byte("linked secret"), 0o644); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Remove(target) })
	if err := os.Symlink(target, filepath.Join(root, "link.txt")); err != nil {
		t.Skipf("symlinks unavailable: %v", err)
	}

	if body, err := Read(root, "link.txt"); err == nil {
		t.Errorf("Read followed a symlink out of the root: %q", body)
	}
	listing, err := Tree(root)
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range listing.Entries {
		if e.Name == "link.txt" {
			t.Error("Tree listed a symlink")
		}
	}
}

func TestTreeRejectsMissingRoot(t *testing.T) {
	if _, err := Tree(""); err == nil {
		t.Error("expected an error for an empty root")
	}
	if _, err := Tree(filepath.Join(t.TempDir(), "nope")); err == nil {
		t.Error("expected an error for a missing root")
	}
}

func TestListingChildrenNavigatesOneLevel(t *testing.T) {
	root := fixture(t)
	listing, err := Tree(root)
	if err != nil {
		t.Fatal(err)
	}

	// The root must show directories and top-level files, never a nested
	// path - that is the difference between a browser and a flat dump.
	for _, entry := range listing.Children("") {
		if strings.Contains(entry.Path, "/") {
			t.Errorf("root listing contained a nested path: %s", entry.Path)
		}
	}

	zsh := listing.Children("zsh")
	if len(zsh) != 1 || zsh[0].Path != "zsh/.zshrc" {
		t.Errorf("Children(zsh) = %+v, want just zsh/.zshrc", zsh)
	}

	if kids := listing.Children("does/not/exist"); len(kids) != 0 {
		t.Errorf("Children of a missing dir = %+v, want none", kids)
	}
}

func TestTreeSynthesisesDirectories(t *testing.T) {
	root := fixture(t)
	listing, err := Tree(root)
	if err != nil {
		t.Fatal(err)
	}
	dirs := map[string]bool{}
	for _, entry := range listing.Entries {
		if entry.IsDir {
			dirs[entry.Path] = true
		}
	}
	for _, want := range []string{"zsh", "git", "secrets", "aws"} {
		if !dirs[want] {
			t.Errorf("expected a synthesised directory entry for %q", want)
		}
	}
	if dirs[".git"] {
		t.Error(".git must never be synthesised as a directory")
	}
}

// A checkout with a .gitignore must be listed from git, not from disk -
// otherwise ignored files (which the author has declared are not part of the
// dotfiles) are served.
func TestTreePrefersGitAndHonoursGitignore(t *testing.T) {
	root := t.TempDir()
	write := func(rel, body string) {
		t.Helper()
		full := filepath.Join(root, filepath.FromSlash(rel))
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(full, []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	write(".gitignore", "ignored.txt\nnode_modules/\n")
	write("tracked.txt", "committed\n")
	write("ignored.txt", "LOCAL ONLY - must not be served\n")

	run := func(args ...string) {
		t.Helper()
		cmd := exec.Command("git", args...)
		cmd.Dir = root
		cmd.Env = append(os.Environ(),
			"GIT_AUTHOR_NAME=t", "GIT_AUTHOR_EMAIL=t@example.com",
			"GIT_COMMITTER_NAME=t", "GIT_COMMITTER_EMAIL=t@example.com")
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Skipf("git %v unavailable: %v (%s)", args, err, out)
		}
	}
	run("init", "-q")
	run("add", ".")
	run("commit", "-qm", "initial")

	listing, err := Tree(root)
	if err != nil {
		t.Fatal(err)
	}
	if listing.Source != SourceGit {
		t.Fatalf("Source = %q, want %q", listing.Source, SourceGit)
	}
	for _, entry := range listing.Entries {
		if entry.Name == "ignored.txt" {
			t.Error("a gitignored file was listed")
		}
	}
	if _, err := Read(root, "ignored.txt"); err == nil {
		// Read is path-based and does not consult git, so this documents the
		// boundary: listing is bounded by git, reading is bounded by the
		// filters. A file must fail at least one of them to stay private.
		t.Log("note: Read is not git-bounded; listing is the boundary")
	}
}

func TestTreeFallsBackToWalkWithoutGit(t *testing.T) {
	root := fixture(t) // no git repo in the fixture
	listing, err := Tree(root)
	if err != nil {
		t.Fatal(err)
	}
	if listing.Source != SourceWalk {
		t.Errorf("Source = %q, want %q", listing.Source, SourceWalk)
	}
}
