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
  tagline: "Software engineer",
  description:
    "Personal site of a software engineer: work, CV and contact. Web applications end to end, from the front-end to the API and the infrastructure under it.",
  url: "https://no-tone.com",
  links: [
    { label: "Work", href: "https://no-tone.com/work" },
    { label: "CV", href: "https://no-tone.com/cv" },
    { label: "GitHub", href: "https://github.com/no-tone" },
    { label: "Contact", href: "mailto:msg@no-tone.com" },
  ],
  markdown: [
    "# no-tone",
    "",
    "Personal site of a software engineer. Web applications end to end: the",
    "front-end, the API behind it, and the infrastructure it runs on.",
    "",
    "## Pages",
    "- **/** - intro",
    "- **/work** - public repositories, newest first",
    "- **/cv** - experience, education, skills",
    "",
    "## Elsewhere",
    "- GitHub: https://github.com/no-tone",
    "- Contact: msg@no-tone.com",
    "- CV over SSH: `ssh cv.no-tone.com`",
    "",
    "## API",
    "- `GET https://api.no-tone.com/projects` - public repositories as JSON",
    "",
    "## More",
    "- Sitemap: https://no-tone.com/sitemap-index.xml",
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
  url: "https://dash.no-tone.com",
  links: [{ label: "Status API", href: "https://api.no-tone.com/status" }],
  markdown: [
    "# main-menu",
    "",
    "A minimal launcher for no-tone's self-hosted services, with live up/down status.",
    "",
    "## API",
    "- `GET /status` - health of every registered app, plus Tailscale device status",
    "",
  ].join("\n"),
};
