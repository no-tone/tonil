import { DASHBOARD_INFO } from "@repo/content";

// Ported from main-menu's src/consts.ts, composed from the shared
// DASHBOARD_INFO record (packages/content/src/site-info.ts) instead of
// duplicating the same name/description as a second copy of the same string.
export const SITE_NAME = DASHBOARD_INFO.name;
export const SITE_URL = DASHBOARD_INFO.url;
export const SITE_TITLE = `${DASHBOARD_INFO.name} | ${DASHBOARD_INFO.tagline}`;
export const SITE_DESCRIPTION = DASHBOARD_INFO.description;
