// Package tui renders the CV, and optionally the dotfiles, as a terminal UI.
//
// The whole thing is one Bubble Tea model with a tab per pane rather than a
// tree of nested models: there are four panes, they share a viewport and a
// language, and the coordination overhead of splitting them would exceed the
// code it saved.
package tui

import (
	"strings"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"github.com/no-tone/tonil/apps/ssh-cv/internal/authz"
	"github.com/no-tone/tonil/apps/ssh-cv/internal/cv"
)

type pane int

const (
	paneOverview pane = iota
	paneExperience
	paneSkills
	paneDotfiles
)

func (p pane) label() string {
	switch p {
	case paneOverview:
		return "overview"
	case paneExperience:
		return "experience"
	case paneSkills:
		return "skills"
	case paneDotfiles:
		return "dotfiles"
	default:
		return ""
	}
}

// Config is everything a session needs to render.
type Config struct {
	Content map[string]cv.Content
	Langs   []string
	// Grant decides whether the dotfiles pane exists at all for this session.
	Grant authz.Grant
	// DotfilesRoot is the directory to browse. Empty disables the pane even
	// for an authorized session, so a host with no checkout degrades cleanly.
	DotfilesRoot string
	// Width and Height come from the SSH PTY request.
	Width  int
	Height int
	// Fingerprint of the connecting key, shown in the footer. Empty for a
	// session that authenticated with no key.
	Fingerprint string
}

type keymap struct {
	quit     key.Binding
	nextPane key.Binding
	prevPane key.Binding
	up       key.Binding
	down     key.Binding
	open     key.Binding
	back     key.Binding
	lang     key.Binding
}

func newKeymap() keymap {
	return keymap{
		quit:     key.NewBinding(key.WithKeys("q", "ctrl+c", "esc")),
		nextPane: key.NewBinding(key.WithKeys("tab", "right", "l")),
		prevPane: key.NewBinding(key.WithKeys("shift+tab", "left", "h")),
		up:       key.NewBinding(key.WithKeys("up", "k")),
		down:     key.NewBinding(key.WithKeys("down", "j")),
		open:     key.NewBinding(key.WithKeys("enter")),
		back:     key.NewBinding(key.WithKeys("backspace")),
		lang:     key.NewBinding(key.WithKeys("p")),
	}
}

// Model is the Bubble Tea model for one SSH session.
type Model struct {
	cfg    Config
	styles styles
	keys   keymap

	panes   []pane
	active  int
	lang    int
	ready   bool
	view    viewport.Model
	width   int
	height  int
	quitted bool

	// The dotfiles pane owns its own state; see browser.go.
	browser *browser
}

// New builds a model. The dotfiles pane is added only when the session both
// holds the scope and has somewhere to read from - an unauthorized session
// does not see a locked tab, it sees no tab, because a visible locked door is
// an invitation.
func New(cfg Config) Model {
	panes := []pane{paneOverview, paneExperience, paneSkills}
	if cfg.Grant.Has(authz.ScopeDotfiles) && cfg.DotfilesRoot != "" {
		panes = append(panes, paneDotfiles)
	}

	m := Model{
		cfg:    cfg,
		styles: newStyles(),
		keys:   newKeymap(),
		panes:  panes,
		width:  cfg.Width,
		height: cfg.Height,
	}
	if m.width <= 0 {
		m.width = 80
	}
	if m.height <= 0 {
		m.height = 24
	}
	if cfg.DotfilesRoot != "" && cfg.Grant.Has(authz.ScopeDotfiles) {
		m.browser = newBrowser(cfg.DotfilesRoot)
	}
	return m
}

func (m Model) Init() tea.Cmd { return nil }

// chrome is the number of rows everything except the viewport occupies, so
// the viewport can be sized to exactly what is left. One too few and the
// frame is taller than the terminal, which scrolls the header off the top
// and leaves a second copy of the footer behind.
//
//	1 app padding top
//	2 header (title + subtitle)
//	1 tabs
//	1 rule
//	- viewport
//	1 rule
//	1 footer
//	1 app padding bottom
const chrome = 8

func (m Model) content() cv.Content {
	return m.cfg.Content[m.cfg.Langs[m.lang]]
}

func (m Model) currentPane() pane {
	if len(m.panes) == 0 {
		return paneOverview
	}
	return m.panes[m.active]
}

func (m *Model) resize(width, height int) {
	m.width = width
	m.height = height
	body := height - chrome
	if body < 3 {
		body = 3
	}
	inner := width - 6
	if inner < 20 {
		inner = 20
	}
	if !m.ready {
		m.view = viewport.New(inner, body)
		m.ready = true
	} else {
		m.view.Width = inner
		m.view.Height = body
	}
	m.refresh()
}

// refresh re-renders the active pane into the viewport. Called on every state
// change rather than during View so View stays a pure read.
func (m *Model) refresh() {
	if !m.ready {
		return
	}
	m.view.SetContent(m.renderPane())
	m.view.GotoTop()
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.resize(msg.Width, msg.Height)
		return m, nil

	case tea.KeyMsg:
		switch {
		case key.Matches(msg, m.keys.quit):
			// Inside the browser, esc means "step back", not "quit" - losing
			// the session because you wanted to leave a file would be rude.
			if m.currentPane() == paneDotfiles && msg.String() == "esc" &&
				m.browser != nil && (m.browser.openFile != "" || m.browser.dir != "") {
				m.browser.back()
				m.refresh()
				return m, nil
			}
			m.quitted = true
			return m, tea.Quit

		case key.Matches(msg, m.keys.nextPane):
			m.active = (m.active + 1) % len(m.panes)
			m.refresh()
			return m, nil

		case key.Matches(msg, m.keys.prevPane):
			m.active = (m.active - 1 + len(m.panes)) % len(m.panes)
			m.refresh()
			return m, nil

		case key.Matches(msg, m.keys.lang):
			m.lang = (m.lang + 1) % len(m.cfg.Langs)
			m.refresh()
			return m, nil

		case m.inBrowser() && key.Matches(msg, m.keys.up):
			m.browser.move(-1)
			m.refresh()
			return m, nil

		case m.inBrowser() && key.Matches(msg, m.keys.down):
			m.browser.move(1)
			m.refresh()
			return m, nil

		case m.inBrowser() && key.Matches(msg, m.keys.open):
			m.browser.enter(m.cfg.DotfilesRoot)
			m.refresh()
			return m, nil

		case m.inBrowser() && key.Matches(msg, m.keys.back):
			m.browser.back()
			m.refresh()
			return m, nil
		}
	}

	if m.ready {
		var cmd tea.Cmd
		m.view, cmd = m.view.Update(msg)
		return m, cmd
	}
	return m, nil
}

// inBrowser reports whether keys should be routed to the dotfiles pane.
func (m Model) inBrowser() bool {
	return m.currentPane() == paneDotfiles && m.browser != nil
}

func (m Model) View() string {
	if m.quitted {
		return ""
	}
	if !m.ready {
		return "\n  loading…\n"
	}

	header := lipgloss.JoinVertical(lipgloss.Left,
		m.styles.title.Render("no-tone"),
		m.styles.subtitle.Render("curriculum vitae · "+m.cfg.Langs[m.lang]),
	)

	tabs := make([]string, 0, len(m.panes))
	for i, p := range m.panes {
		if i == m.active {
			tabs = append(tabs, m.styles.tabActive.Render(p.label()))
		} else {
			tabs = append(tabs, m.styles.tab.Render(p.label()))
		}
	}

	rule := m.styles.rule.Render(strings.Repeat("─", max(m.width-6, 10)))

	return m.styles.app.Render(lipgloss.JoinVertical(lipgloss.Left,
		header,
		lipgloss.JoinHorizontal(lipgloss.Top, tabs...),
		rule,
		m.view.View(),
		rule,
		m.footer(),
	))
}

func (m Model) footer() string {
	keys := []string{"tab panes", "↑/↓ scroll", "p língua", "q quit"}
	if m.inBrowser() {
		keys = []string{"↑/↓ move", "enter open", "esc back", "tab panes", "q quit"}
	}
	left := m.styles.help.Render(strings.Join(keys, m.styles.faint.Render(" · ")))

	right := ""
	if label := m.cfg.Grant.Label; label != "" {
		right = m.styles.accent.Render(label)
	} else if m.cfg.Fingerprint != "" {
		right = m.styles.faint.Render(shortFingerprint(m.cfg.Fingerprint))
	}
	if right == "" {
		return left
	}

	gap := m.width - 6 - lipgloss.Width(left) - lipgloss.Width(right)
	if gap < 1 {
		return left
	}
	return left + strings.Repeat(" ", gap) + right
}

// shortFingerprint trims a SHA256 fingerprint to something that fits a footer
// while staying long enough to recognise your own key.
func shortFingerprint(fingerprint string) string {
	if len(fingerprint) <= 18 {
		return fingerprint
	}
	return fingerprint[:18] + "…"
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
