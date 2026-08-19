package tui

import (
	"strings"

	"github.com/charmbracelet/lipgloss"
)

// renderPane produces the scrollable body for whichever pane is active.
// Everything is plain string building - the viewport handles scrolling, so
// these only have to produce a tall block of text at the right width.
func (m Model) renderPane() string {
	switch m.currentPane() {
	case paneOverview:
		return m.renderOverview()
	case paneExperience:
		return m.renderExperience()
	case paneSkills:
		return m.renderSkills()
	case paneDotfiles:
		return m.renderDotfiles()
	default:
		return ""
	}
}

func (m Model) renderOverview() string {
	content := m.content()
	var b strings.Builder

	b.WriteString(m.styles.section.Render("best at") + "\n")
	// The key column is padded to the widest key so the values line up into a
	// column, which is what makes a ranked list scan as a ranking.
	width := 0
	for _, row := range content.BestAt {
		if w := lipgloss.Width(row.K); w > width {
			width = w
		}
	}
	// Values wrap into the column rather than running off the edge - a CV
	// read at 80 columns over SSH is the common case, not the narrow one.
	valueWidth := m.view.Width - width - 4
	if valueWidth < 24 {
		valueWidth = 24
	}
	for _, row := range content.BestAt {
		pad := strings.Repeat(" ", max(width-lipgloss.Width(row.K), 0))
		lines := wrapText(row.V, valueWidth)
		for i, line := range lines {
			if i == 0 {
				b.WriteString("  " + m.styles.role.Render(row.K) + pad + "  " +
					m.styles.muted.Render(line) + "\n")
				continue
			}
			b.WriteString("  " + strings.Repeat(" ", width) + "  " +
				m.styles.muted.Render(line) + "\n")
		}
	}

	b.WriteString(m.styles.section.Render("education") + "\n")
	for _, edu := range content.Education {
		b.WriteString("  " + m.styles.role.Render(edu.Title) +
			"  " + m.styles.period.Render(edu.Period) + "\n")
		for _, bullet := range edu.Bullets {
			b.WriteString(m.styles.bullet.Render("· "+bullet) + "\n")
		}
	}

	b.WriteString(m.styles.section.Render("languages") + "\n")
	b.WriteString(m.chips(content.Spoken) + "\n")

	b.WriteString(m.styles.section.Render("interests") + "\n")
	b.WriteString(m.chips(content.Interests) + "\n")

	return b.String()
}

func (m Model) renderExperience() string {
	var b strings.Builder
	for i, exp := range m.content().Experience {
		if i > 0 {
			b.WriteString("\n")
		}
		head := m.styles.role.Render(exp.Role)
		period := m.styles.period.Render(exp.Period)
		gap := m.view.Width - lipgloss.Width(head) - lipgloss.Width(period)
		if gap < 1 {
			gap = 1
		}
		b.WriteString(head + strings.Repeat(" ", gap) + period + "\n")
		b.WriteString(m.styles.org.Render(exp.Org+" · "+exp.Place) + "\n")
		for _, bullet := range exp.Bullets {
			b.WriteString(m.wrapBullet(bullet) + "\n")
		}
	}
	return b.String()
}

func (m Model) renderSkills() string {
	var b strings.Builder
	for _, group := range m.content().Skills {
		b.WriteString(m.styles.section.Render(group.Label) + "\n")
		b.WriteString(m.chips(group.Items) + "\n")
	}
	return b.String()
}

// chips lays items out as bordered pills, wrapping at the viewport width.
func (m Model) chips(items []string) string {
	if len(items) == 0 {
		return ""
	}
	var lines []string
	var row []string
	width := 0
	limit := m.view.Width - 2
	if limit < 10 {
		limit = 10
	}
	for _, item := range items {
		chip := m.styles.chip.Render(item)
		w := lipgloss.Width(chip)
		if width+w > limit && len(row) > 0 {
			lines = append(lines, lipgloss.JoinHorizontal(lipgloss.Top, row...))
			row, width = nil, 0
		}
		row = append(row, chip)
		width += w
	}
	if len(row) > 0 {
		lines = append(lines, lipgloss.JoinHorizontal(lipgloss.Top, row...))
	}
	// Indent as a block. Prefixing spaces to the string would only shift the
	// chips' top border, because each chip is three lines tall.
	return lipgloss.NewStyle().PaddingLeft(2).Render(strings.Join(lines, "\n"))
}

// wrapBullet hard-wraps a bullet to the viewport, hanging the continuation
// lines under the text rather than under the marker.
func (m Model) wrapBullet(text string) string {
	limit := m.view.Width - 4
	if limit < 20 {
		limit = 20
	}
	lines := wrapText(text, limit)

	var b strings.Builder
	for i, line := range lines {
		marker := "  · "
		if i > 0 {
			marker = "    "
		}
		b.WriteString(m.styles.muted.Render(marker + line))
		if i < len(lines)-1 {
			b.WriteString("\n")
		}
	}
	return b.String()
}

// wrapText greedily breaks text at word boundaries. lipgloss.Width is used
// rather than len so wide glyphs and accents measure as they render.
func wrapText(text string, limit int) []string {
	if limit < 1 {
		limit = 1
	}
	var lines []string
	current := ""
	for _, word := range strings.Fields(text) {
		candidate := word
		if current != "" {
			candidate = current + " " + word
		}
		if lipgloss.Width(candidate) > limit && current != "" {
			lines = append(lines, current)
			current = word
		} else {
			current = candidate
		}
	}
	if current != "" {
		lines = append(lines, current)
	}
	if len(lines) == 0 {
		return []string{""}
	}
	return lines
}
