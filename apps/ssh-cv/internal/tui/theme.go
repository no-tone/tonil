package tui

import "github.com/charmbracelet/lipgloss"

// The palette is the site's signature accents (packages/ui/src/gradient/ramps.ts,
// SIGNATURE_ACCENTS) narrowed to what a terminal can show. Hex is given
// alongside a 256-colour fallback so the same session looks deliberate on a
// truecolor terminal and merely plain on an old one, rather than unreadable.
var (
	colAccent = lipgloss.AdaptiveColor{Light: "#d24500", Dark: "#ff5c00"}
	colText   = lipgloss.AdaptiveColor{Light: "#222939", Dark: "#ffffff"}
	colMuted  = lipgloss.AdaptiveColor{Light: "#5a6274", Dark: "#9aa0ab"}
	colFaint  = lipgloss.AdaptiveColor{Light: "#8b93a3", Dark: "#6b7280"}
	colRule   = lipgloss.AdaptiveColor{Light: "#d6d3cc", Dark: "#2a2d35"}
	colDanger = lipgloss.AdaptiveColor{Light: "#be1239", Dark: "#ff5c7a"}
)

type styles struct {
	app        lipgloss.Style
	title      lipgloss.Style
	subtitle   lipgloss.Style
	section    lipgloss.Style
	role       lipgloss.Style
	period     lipgloss.Style
	org        lipgloss.Style
	bullet     lipgloss.Style
	body       lipgloss.Style
	muted      lipgloss.Style
	faint      lipgloss.Style
	accent     lipgloss.Style
	chip       lipgloss.Style
	tab        lipgloss.Style
	tabActive  lipgloss.Style
	rule       lipgloss.Style
	help       lipgloss.Style
	helpKey    lipgloss.Style
	selected   lipgloss.Style
	unselected lipgloss.Style
	locked     lipgloss.Style
	code       lipgloss.Style
}

func newStyles() styles {
	return styles{
		app:      lipgloss.NewStyle().Padding(1, 3),
		title:    lipgloss.NewStyle().Foreground(colText).Bold(true),
		subtitle: lipgloss.NewStyle().Foreground(colMuted),
		section: lipgloss.NewStyle().
			Foreground(colAccent).Bold(true).MarginTop(1),
		role:   lipgloss.NewStyle().Foreground(colText).Bold(true),
		period: lipgloss.NewStyle().Foreground(colFaint),
		org:    lipgloss.NewStyle().Foreground(colMuted).Italic(true),
		bullet: lipgloss.NewStyle().Foreground(colMuted).PaddingLeft(2),
		body:   lipgloss.NewStyle().Foreground(colText),
		muted:  lipgloss.NewStyle().Foreground(colMuted),
		faint:  lipgloss.NewStyle().Foreground(colFaint),
		accent: lipgloss.NewStyle().Foreground(colAccent),
		chip: lipgloss.NewStyle().
			Foreground(colMuted).
			Border(lipgloss.RoundedBorder()).BorderForeground(colRule).
			Padding(0, 1).MarginRight(1),
		tab:       lipgloss.NewStyle().Foreground(colFaint).Padding(0, 2),
		tabActive: lipgloss.NewStyle().Foreground(colAccent).Bold(true).Padding(0, 2),
		rule:      lipgloss.NewStyle().Foreground(colRule),
		help:      lipgloss.NewStyle().Foreground(colFaint),
		helpKey:   lipgloss.NewStyle().Foreground(colMuted),
		selected: lipgloss.NewStyle().
			Foreground(colAccent).Bold(true),
		unselected: lipgloss.NewStyle().Foreground(colMuted),
		locked:     lipgloss.NewStyle().Foreground(colDanger),
		code:       lipgloss.NewStyle().Foreground(colText),
	}
}
