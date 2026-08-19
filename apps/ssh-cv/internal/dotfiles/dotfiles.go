// Package dotfiles exposes a read-only, filtered view of a dotfiles checkout.
//
// The repository is private, and a private repository is private for reasons
// that are not always obvious when you wrote it - a hostname here, a token
// there. Two independent defences apply, because access control and content
// filtering fail in different ways:
//
//   - Access: only a session holding the dotfiles scope reaches this package
//     at all (see internal/authz).
//   - Content: even for an authorized session, anything that looks like a
//     credential is never read off disk, and anything that is not
//     human-readable text is never sent to a terminal.
//
// The tree is read at request time from a directory on the host rather than
// embedded in the binary. That keeps `git pull` as the update mechanism, and
// means a copy of the binary is not a copy of the dotfiles.
package dotfiles

import (
	"errors"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"unicode/utf8"
)

// MaxFileBytes caps what will be read into memory and pushed at a terminal.
// Real config files are kilobytes; anything past this is not something you
// want to page through over SSH anyway.
const MaxFileBytes = 256 * 1024

// ErrNotFound is returned for a path that does not exist, is filtered, or
// escapes the root. Deliberately one error for all three: distinguishing them
// would let a caller map the filesystem by watching which paths answer
// differently.
var ErrNotFound = errors.New("not found")

// skippedDirs never appear in the tree. .git is excluded because it holds
// every version of every file ever committed, including ones since deleted -
// filtering the working tree while serving its history would be pointless.
var skippedDirs = map[string]bool{
	".git":         true,
	"node_modules": true,
	".DS_Store":    true,
}

// secretNames are exact filenames that are never read, whatever their
// contents. Matched case-insensitively.
var secretNames = map[string]bool{
	".env":            true,
	".envrc":          true,
	".netrc":          true,
	".pgpass":         true,
	"credentials":     true,
	"id_rsa":          true,
	"id_ed25519":      true,
	"id_ecdsa":        true,
	"id_dsa":          true,
	".htpasswd":       true,
	"secrets.json":    true,
	"authorized_keys": true,
}

// secretSuffixes match anything carrying key material regardless of name.
var secretSuffixes = []string{
	".pem", ".key", ".p12", ".pfx", ".jks", ".keystore",
	".asc", ".gpg", ".kdbx", ".ppk",
}

// secretInfixes catch the long tail - `aws-credentials`, `npm-token.txt`,
// `foo.secret.yml`. Broad on purpose: a false positive hides one config file,
// a false negative publishes a credential.
var secretInfixes = []string{
	"secret", "token", "password", "passwd", "credential", "private-key", "privatekey",
}

// IsSensitive reports whether a filename should never be read.
func IsSensitive(name string) bool {
	lower := strings.ToLower(name)
	if secretNames[lower] {
		return true
	}
	for _, suffix := range secretSuffixes {
		if strings.HasSuffix(lower, suffix) {
			return true
		}
	}
	for _, infix := range secretInfixes {
		if strings.Contains(lower, infix) {
			return true
		}
	}
	return false
}

// Entry is one node in the browsable tree.
type Entry struct {
	// Path is slash-separated and relative to the root. Never absolute, never
	// contains "..", so it is safe to render and safe to hand back to Read.
	Path  string
	Name  string
	IsDir bool
	Size  int64
	// Sensitive marks an entry that is listed but will not be read. Showing
	// that a file exists while refusing its contents is more honest than
	// hiding it - you can see the shape of the setup without the keys.
	Sensitive bool
}

// Listing is a browsable snapshot of the dotfiles.
type Listing struct {
	Entries []Entry
	// Source records how the file list was obtained. Surfaced in the UI
	// because "these are the committed files" and "these are the files that
	// happen to be in this directory" are meaningfully different claims.
	Source Source
}

// Children returns the entries directly inside dir ("" for the root), which
// is what a one-level-at-a-time browser needs.
//
// A flat, fully-indented tree is fine for a toy fixture and unusable for a
// real checkout - the repo this was built against has 300 directories. Paging
// through one level at a time keeps the pane readable at any size.
func (l Listing) Children(dir string) []Entry {
	var children []Entry
	for _, entry := range l.Entries {
		if path.Dir(entry.Path) == dirKey(dir) {
			children = append(children, entry)
		}
	}
	return children
}

// dirKey normalises "" (the root) to the "." that path.Dir reports for a
// top-level entry.
func dirKey(dir string) string {
	if dir == "" {
		return "."
	}
	return dir
}

// Tree lists root, preferring git's view of it.
//
// Directory entries are synthesised from the file paths rather than taken
// from the filesystem, so a directory that exists on disk but holds nothing
// listable never appears as an empty dead end.
func Tree(root string) (Listing, error) {
	if root == "" {
		return Listing{}, errors.New("dotfiles: no root configured")
	}
	info, err := os.Stat(root)
	if err != nil {
		return Listing{}, fmt.Errorf("dotfiles: stat root: %w", err)
	}
	if !info.IsDir() {
		return Listing{}, fmt.Errorf("dotfiles: root %q is not a directory", root)
	}

	source := SourceGit
	paths, ok := listTracked(root)
	if !ok {
		source = SourceWalk
		paths, err = listWalked(root)
		if err != nil {
			return Listing{}, fmt.Errorf("dotfiles: walk: %w", err)
		}
	}

	seenDirs := map[string]bool{}
	var entries []Entry
	for _, relative := range paths {
		if !safeRelPath(relative) {
			continue
		}
		absolute := filepath.Join(root, filepath.FromSlash(relative))
		// git lists what is committed, which may include a file since
		// deleted from the working tree, and never a symlink we should
		// follow. Confirm against the filesystem before listing it.
		stat, statErr := os.Lstat(absolute)
		if statErr != nil || !stat.Mode().IsRegular() {
			continue
		}

		for _, dir := range ancestors(relative) {
			if seenDirs[dir] {
				continue
			}
			seenDirs[dir] = true
			entries = append(entries, Entry{
				Path:  dir,
				Name:  path.Base(dir),
				IsDir: true,
			})
		}

		entries = append(entries, Entry{
			Path:      relative,
			Name:      path.Base(relative),
			Size:      stat.Size(),
			Sensitive: IsSensitive(path.Base(relative)),
		})
	}

	sort.Slice(entries, func(i, j int) bool {
		a, b := entries[i], entries[j]
		if dirA, dirB := path.Dir(a.Path), path.Dir(b.Path); dirA != dirB {
			return dirA < dirB
		}
		if a.IsDir != b.IsDir {
			return a.IsDir
		}
		return a.Name < b.Name
	})
	return Listing{Entries: entries, Source: source}, nil
}

// ancestors lists every directory above a path, shallowest first.
func ancestors(relative string) []string {
	var dirs []string
	for dir := path.Dir(relative); dir != "." && dir != "/" && dir != ""; dir = path.Dir(dir) {
		dirs = append([]string{dir}, dirs...)
	}
	return dirs
}

// safeRelPath rejects anything that escapes the root or touches a skipped
// directory. Applied to every listing source, so a source cannot widen what
// is reachable just by returning a different shape of path.
func safeRelPath(relative string) bool {
	if relative == "" || relative == "." || path.IsAbs(relative) {
		return false
	}
	for _, segment := range strings.Split(relative, "/") {
		if segment == ".." || segment == "." || skippedDirs[segment] {
			return false
		}
	}
	return true
}

// Read returns the contents of one file.
//
// relative is treated as untrusted: it is cleaned, rejected if it escapes the
// root, and re-checked against the filters rather than trusting whatever the
// caller believed about it when it built the tree.
func Read(root, relative string) (string, error) {
	if root == "" {
		return "", ErrNotFound
	}

	cleaned := path.Clean("/" + filepath.ToSlash(relative))[1:]
	if !safeRelPath(cleaned) || IsSensitive(path.Base(cleaned)) {
		return "", ErrNotFound
	}

	absolute := filepath.Join(root, filepath.FromSlash(cleaned))
	// Belt and braces: Join already cleans, but confirm the result is still
	// under root before touching the filesystem.
	if rel, err := filepath.Rel(root, absolute); err != nil ||
		rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", ErrNotFound
	}

	info, err := os.Lstat(absolute)
	if err != nil || !info.Mode().IsRegular() {
		return "", ErrNotFound
	}
	if info.Size() > MaxFileBytes {
		return "", fmt.Errorf("%s is %d bytes, over the %d byte limit",
			cleaned, info.Size(), MaxFileBytes)
	}

	data, err := os.ReadFile(absolute)
	if err != nil {
		return "", ErrNotFound
	}
	// A terminal handed arbitrary bytes will interpret escape sequences in
	// them. Only well-formed UTF-8 without control characters goes out.
	if !utf8.Valid(data) {
		return "", fmt.Errorf("%s is not text", cleaned)
	}
	return sanitize(string(data)), nil
}

// sanitize strips control characters that a terminal would act on, leaving
// tab and newline. Without this a config file containing an escape sequence
// could repaint or reprogram the viewer's terminal.
func sanitize(s string) string {
	return strings.Map(func(r rune) rune {
		switch {
		case r == '\n' || r == '\t':
			return r
		case r == '\r':
			return -1
		case r < 0x20 || r == 0x7f:
			return -1
		default:
			return r
		}
	}, s)
}
