package tui

import (
	"fmt"
	"path"
	"strings"

	"github.com/no-tone/tonil/apps/ssh-cv/internal/dotfiles"
)

// browser is the dotfiles pane's state: which directory is open, where the
// cursor is in it, and whether a file is being shown instead of the listing.
//
// Kept apart from Model because it is the only pane with state of its own,
// and folding its five fields and four transitions into the top-level model
// is how a model turns into a god object. Model owns one of these and
// forwards keys to it.
type browser struct {
	listing dotfiles.Listing
	err     error

	// dir is the directory being listed, "" for the root.
	dir    string
	cursor int
	// A cursor per directory, so stepping into a folder and back out returns
	// you to where you were rather than to the top.
	cursors map[string]int

	openFile string
	fileBody string
	fileErr  string
}

func newBrowser(root string) *browser {
	b := &browser{cursors: map[string]int{}}
	if root == "" {
		return b
	}
	b.listing, b.err = dotfiles.Tree(root)
	return b
}

// rows is what the current directory shows: a ".." row when nested, then its
// children.
func (b *browser) rows() []dotfiles.Entry {
	children := b.listing.Children(b.dir)
	if b.dir == "" {
		return children
	}
	up := dotfiles.Entry{Path: path.Dir(b.dir), Name: "..", IsDir: true}
	if up.Path == "." {
		up.Path = ""
	}
	return append([]dotfiles.Entry{up}, children...)
}

func (b *browser) move(delta int) {
	if b.openFile != "" {
		return
	}
	next := b.cursor + delta
	if next < 0 || next >= len(b.rows()) {
		return
	}
	b.cursor = next
	b.cursors[b.dir] = next
}

// enter descends into a directory or opens a file.
func (b *browser) enter(root string) {
	if b.openFile != "" {
		return
	}
	rows := b.rows()
	if b.cursor < 0 || b.cursor >= len(rows) {
		return
	}
	entry := rows[b.cursor]

	if entry.IsDir {
		b.cursors[b.dir] = b.cursor
		b.dir = entry.Path
		b.cursor = b.cursors[b.dir]
		if b.cursor >= len(b.rows()) {
			b.cursor = 0
		}
		b.fileErr = ""
		return
	}

	if entry.Sensitive {
		// Say why. Silently doing nothing reads as a bug, and the fact that a
		// credential-shaped file exists is not itself a secret.
		b.fileErr = fmt.Sprintf("%s is withheld - it matches a credential pattern.", entry.Name)
		return
	}

	body, err := dotfiles.Read(root, entry.Path)
	if err != nil {
		b.fileErr = err.Error()
		return
	}
	b.openFile, b.fileBody, b.fileErr = entry.Path, body, ""
}

// back closes an open file, or steps up a directory.
func (b *browser) back() {
	if b.openFile != "" {
		b.openFile, b.fileBody, b.fileErr = "", "", ""
		return
	}
	if b.dir == "" {
		return
	}
	child := b.dir
	parent := path.Dir(b.dir)
	if parent == "." {
		parent = ""
	}
	b.dir = parent
	b.cursor = b.cursors[parent]
	// Land on the directory just left, so up-then-down is a round trip.
	for i, entry := range b.rows() {
		if entry.Path == child && entry.Name != ".." {
			b.cursor = i
			break
		}
	}
	b.fileErr = ""
}

// breadcrumb renders the current location, and where the listing came from.
func (m Model) breadcrumb() string {
	b := m.browser
	location := "dotfiles"
	if b.dir != "" {
		location += "/" + b.dir
	}
	origin := "listed from disk"
	if b.listing.Source == dotfiles.SourceGit {
		origin = "tracked files only"
	}
	return m.styles.accent.Render(location) + "  " +
		m.styles.faint.Render("· "+origin+" · read-only · credentials withheld")
}

func (m Model) renderDotfiles() string {
	b := m.browser
	if b.err != nil {
		return m.styles.locked.Render("dotfiles unavailable: " + b.err.Error())
	}
	if b.openFile != "" {
		return m.renderFile()
	}

	var out strings.Builder
	out.WriteString(m.breadcrumb() + "\n\n")
	if b.fileErr != "" {
		out.WriteString(m.styles.locked.Render(b.fileErr) + "\n\n")
	}

	rows := b.rows()
	if len(rows) == 0 {
		out.WriteString(m.styles.faint.Render("(empty)") + "\n")
		return out.String()
	}

	for i, entry := range rows {
		name := entry.Name
		if entry.IsDir && name != ".." {
			name += "/"
		}

		marker := "  "
		style := m.styles.unselected
		if i == b.cursor {
			marker = "› "
			style = m.styles.selected
		}

		line := style.Render(marker + name)
		switch {
		case entry.Sensitive:
			line += " " + m.styles.locked.Render("withheld")
		case !entry.IsDir:
			line += " " + m.styles.faint.Render(humanSize(entry.Size))
		}
		out.WriteString(line + "\n")
	}
	return out.String()
}

func (m Model) renderFile() string {
	b := m.browser
	var out strings.Builder
	out.WriteString(m.styles.accent.Render(b.openFile) + "\n")
	out.WriteString(m.styles.rule.Render(strings.Repeat("─", max(m.view.Width, 10))) + "\n")
	// Line numbers make a config scannable, and make truncation by the size
	// cap obvious rather than silent.
	for i, line := range strings.Split(strings.TrimRight(b.fileBody, "\n"), "\n") {
		number := m.styles.faint.Render(fmt.Sprintf("%4d ", i+1))
		out.WriteString(number + m.styles.code.Render(line) + "\n")
	}
	return out.String()
}

func humanSize(bytes int64) string {
	switch {
	case bytes < 1024:
		return fmt.Sprintf("%dB", bytes)
	case bytes < 1024*1024:
		return fmt.Sprintf("%.1fK", float64(bytes)/1024)
	default:
		return fmt.Sprintf("%.1fM", float64(bytes)/(1024*1024))
	}
}
