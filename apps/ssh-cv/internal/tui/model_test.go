package tui

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"

	"github.com/no-tone/tonil/apps/ssh-cv/internal/authz"
	"github.com/no-tone/tonil/apps/ssh-cv/internal/cv"
)

func testContent(t *testing.T) (map[string]cv.Content, []string) {
	t.Helper()
	byLang, langs, err := cv.Load()
	if err != nil {
		t.Fatalf("load cv: %v", err)
	}
	return byLang, langs
}

func dotfilesFixture(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	for rel, body := range map[string]string{
		"README.md":       "# dotfiles\n",
		"zsh/.zshrc":      "export EDITOR=nvim\n",
		"secrets/api.key": "SUPER SECRET",
	} {
		full := filepath.Join(root, filepath.FromSlash(rel))
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(full, []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return root
}

func newTestModel(t *testing.T, grant authz.Grant, dotfilesRoot string) Model {
	t.Helper()
	byLang, langs := testContent(t)
	m := New(Config{
		Content:      byLang,
		Langs:        langs,
		Grant:        grant,
		DotfilesRoot: dotfilesRoot,
		Width:        100,
		Height:       32,
	})
	updated, _ := m.Update(tea.WindowSizeMsg{Width: 100, Height: 32})
	return updated.(Model)
}

func press(t *testing.T, m Model, keys ...string) Model {
	t.Helper()
	for _, k := range keys {
		var msg tea.KeyMsg
		switch k {
		case "tab":
			msg = tea.KeyMsg{Type: tea.KeyTab}
		case "enter":
			msg = tea.KeyMsg{Type: tea.KeyEnter}
		case "esc":
			msg = tea.KeyMsg{Type: tea.KeyEscape}
		case "down":
			msg = tea.KeyMsg{Type: tea.KeyDown}
		case "up":
			msg = tea.KeyMsg{Type: tea.KeyUp}
		default:
			msg = tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune(k)}
		}
		updated, _ := m.Update(msg)
		m = updated.(Model)
	}
	return m
}

func paneLabels(m Model) []string {
	labels := make([]string, 0, len(m.panes))
	for _, p := range m.panes {
		labels = append(labels, p.label())
	}
	return labels
}

// The single most important property: a session without the scope has no
// dotfiles pane at all - not a disabled one, not a locked one. A visible
// locked door is an invitation.
func TestUnauthorizedSessionHasNoDotfilesPane(t *testing.T) {
	root := dotfilesFixture(t)
	m := newTestModel(t, authz.Grant{}, root)

	if got := paneLabels(m); len(got) != 3 {
		t.Fatalf("panes = %v, want exactly the three public ones", got)
	}
	for _, label := range paneLabels(m) {
		if label == "dotfiles" {
			t.Fatal("an unauthorized session was offered a dotfiles pane")
		}
	}
	if m.browser != nil {
		t.Error("an unauthorized session must not even build a browser")
	}

	// Cycling every pane must never render anything from the tree.
	for i := 0; i < 6; i++ {
		m = press(t, m, "tab")
		view := m.View()
		for _, leak := range []string{"dotfiles", ".zshrc", "api.key", "SUPER SECRET"} {
			if strings.Contains(view, leak) {
				t.Errorf("pane %d leaked %q", i, leak)
			}
		}
	}
}

func TestAuthorizedSessionGetsDotfilesPane(t *testing.T) {
	root := dotfilesFixture(t)
	m := newTestModel(t, authz.Grant{Label: "laptop", Scopes: []authz.Scope{authz.ScopeDotfiles}}, root)

	labels := paneLabels(m)
	if len(labels) != 4 || labels[3] != "dotfiles" {
		t.Fatalf("panes = %v, want a trailing dotfiles pane", labels)
	}
	if m.browser == nil {
		t.Fatal("expected a browser")
	}
}

// A grant with no root, or a root with no grant, must both come out empty:
// the pane needs the scope *and* somewhere to read from.
func TestDotfilesPaneNeedsBothScopeAndRoot(t *testing.T) {
	granted := authz.Grant{Scopes: []authz.Scope{authz.ScopeDotfiles}}
	if labels := paneLabels(newTestModel(t, granted, "")); len(labels) != 3 {
		t.Errorf("scope with no root gave panes %v", labels)
	}
	if labels := paneLabels(newTestModel(t, authz.Grant{}, dotfilesFixture(t))); len(labels) != 3 {
		t.Errorf("root with no scope gave panes %v", labels)
	}
}

func TestBrowserRefusesSensitiveFile(t *testing.T) {
	root := dotfilesFixture(t)
	m := newTestModel(t, authz.Grant{Scopes: []authz.Scope{authz.ScopeDotfiles}}, root)
	m = press(t, m, "tab", "tab", "tab") // to the dotfiles pane

	// Walk to secrets/ and try to open the key inside it.
	for i := 0; i < len(m.browser.rows()); i++ {
		if m.browser.rows()[i].Name == "secrets" {
			break
		}
		m = press(t, m, "down")
	}
	m = press(t, m, "enter") // into secrets/
	m = press(t, m, "down")  // past ".."
	m = press(t, m, "enter") // attempt to open api.key

	if m.browser.openFile != "" {
		t.Errorf("opened a sensitive file: %s", m.browser.openFile)
	}
	view := m.View()
	if strings.Contains(view, "SUPER SECRET") {
		t.Error("sensitive file contents reached the view")
	}
	if !strings.Contains(view, "withheld") {
		t.Error("expected the refusal to be explained, not silent")
	}
}

func TestBrowserNavigatesInAndBackOut(t *testing.T) {
	root := dotfilesFixture(t)
	m := newTestModel(t, authz.Grant{Scopes: []authz.Scope{authz.ScopeDotfiles}}, root)
	m = press(t, m, "tab", "tab", "tab")

	for m.browser.rows()[m.browser.cursor].Name != "zsh" {
		m = press(t, m, "down")
	}
	m = press(t, m, "enter")
	if m.browser.dir != "zsh" {
		t.Fatalf("dir = %q, want zsh", m.browser.dir)
	}

	m = press(t, m, "esc")
	if m.browser.dir != "" {
		t.Fatalf("dir = %q after esc, want the root", m.browser.dir)
	}
	// Stepping back out should land on the directory just left.
	if name := m.browser.rows()[m.browser.cursor].Name; name != "zsh" {
		t.Errorf("cursor landed on %q, want zsh", name)
	}
}

// esc inside the browser means "back", but at the root with nothing open it
// must still quit - otherwise there is no way out.
func TestEscQuitsFromTheBrowserRoot(t *testing.T) {
	root := dotfilesFixture(t)
	m := newTestModel(t, authz.Grant{Scopes: []authz.Scope{authz.ScopeDotfiles}}, root)
	m = press(t, m, "tab", "tab", "tab")

	if m.quitted {
		t.Fatal("quit too early")
	}
	m = press(t, m, "esc")
	if !m.quitted {
		t.Error("esc at the browser root should quit")
	}
}

func TestLanguageToggle(t *testing.T) {
	byLang, langs := testContent(t)
	if len(langs) < 2 {
		t.Skip("needs at least two languages")
	}
	m := newTestModel(t, authz.Grant{}, "")

	before := m.View()
	m = press(t, m, "p")
	after := m.View()
	if before == after {
		t.Error("toggling language changed nothing")
	}
	if !strings.Contains(after, langs[1]) {
		t.Errorf("expected the view to name %q", langs[1])
	}
	// And the content really is the other language, not just the label.
	if byLang[langs[0]].Experience[0].Role == byLang[langs[1]].Experience[0].Role {
		t.Skip("languages share a first role; nothing to assert")
	}
	if strings.Contains(after, byLang[langs[0]].Experience[0].Role) {
		t.Error("still showing the first language's content")
	}
}

func TestQuitSetsQuitted(t *testing.T) {
	m := press(t, newTestModel(t, authz.Grant{}, ""), "q")
	if !m.quitted {
		t.Error("q should quit")
	}
	if m.View() != "" {
		t.Error("a quitted model should render nothing")
	}
}

func TestFooterShowsGrantLabel(t *testing.T) {
	m := newTestModel(t, authz.Grant{Label: "laptop"}, "")
	if !strings.Contains(m.View(), "laptop") {
		t.Error("expected the key label in the footer")
	}
}

// The frame must fit the terminal exactly. One row too many and the header
// scrolls off the top, leaving a second footer behind.
func TestFrameFitsTheTerminal(t *testing.T) {
	for _, size := range [][2]int{{80, 24}, {100, 32}, {120, 50}, {60, 20}} {
		byLang, langs := testContent(t)
		m := New(Config{Content: byLang, Langs: langs, Width: size[0], Height: size[1]})
		updated, _ := m.Update(tea.WindowSizeMsg{Width: size[0], Height: size[1]})
		lines := strings.Split(updated.(Model).View(), "\n")
		if len(lines) > size[1] {
			t.Errorf("%dx%d rendered %d rows, over by %d",
				size[0], size[1], len(lines), len(lines)-size[1])
		}
	}
}
