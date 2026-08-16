export interface SiteInfo {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  url: string;
  links: { label: string; href: string }[];
  /** Machine-readable homepage served to agents that send `Accept: text/markdown`. */
  markdown: string;
}

export const NO_TONE_INFO: SiteInfo = {
  slug: "no-tone",
  name: "no-tone",
  tagline: "Personal desktop",
  description:
    "A dark, monochrome desktop-style portfolio navigated through an interactive dotted globe.",
  url: "https://no-tone.com",
  links: [
    { label: "Projects", href: "https://no-tone.com/#projects" },
    { label: "GitHub", href: "https://github.com/no-tone" },
    { label: "Contact", href: "mailto:msg@no-tone.com" },
  ],
  markdown: [
    "# no-tone",
    "",
    "A dark, monochrome desktop-style portfolio navigated through an interactive dotted globe.",
    "",
    "## Navigate",
    "- **projects** — selected work, live from GitHub",
    "- **cv** — experience, education, skills",
    "- **about** — bio, stack, and contact",
    "- **github** — https://github.com/no-tone",
    "- **contact** — msg@no-tone.com",
    "",
    "## API",
    "- `GET /projects` — public repositories as JSON",
    "",
    "## More",
    "- Sitemap: https://no-tone.com/sitemap.xml",
    "- API catalog: https://api.no-tone.com/.well-known/api-catalog",
    "",
  ].join("\n"),
};

export const DASHBOARD_INFO: SiteInfo = {
  slug: "dashboard",
  name: "main-menu",
  tagline: "Self-hosted services launcher",
  description:
    "A minimal launcher and live health/status board for no-tone's self-hosted services.",
  url: "https://dashboard.no-tone.com",
  links: [{ label: "Status API", href: "https://api.no-tone.com/status" }],
  markdown: [
    "# main-menu",
    "",
    "A minimal launcher for no-tone's self-hosted services, with live up/down status.",
    "",
    "## API",
    "- `GET /status` — health of every registered app, plus Tailscale device status",
    "",
  ].join("\n"),
};
