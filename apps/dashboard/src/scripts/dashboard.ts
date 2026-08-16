/**
 * Wires up the launcher page: collects the rendered app tiles, and connects
 * the pure logic in this directory (filter.ts, status-resolution.ts,
 * tailnet.ts, client-probe.ts, status-client.ts, theme.ts) to the actual DOM.
 * This module is intentionally "thin glue" — branching logic that's worth
 * unit testing lives in the modules it imports, not here.
 */
import { pingUrl } from "./client-probe";
import { matchesFilter } from "./filter";
import { fetchServerStatuses } from "./status-client";
import { resolveTileStatus, type TileStatus } from "./status-resolution";
import { detectTailnetPresence } from "./tailnet";
import { initThemeToggle } from "./theme";

const STATUS_REFRESH_MS = 90_000;
const STATUS_TIMEOUT_MS = 2500;
const CLIENT_TIMEOUT_MS = 1200;
const TAILNET_IP_TIMEOUT_MS = 700;
const TAILNET_IP_CACHE_MS = 30_000;

const STATUS_LABEL: Record<TileStatus, string> = {
  up: "up",
  down: "down",
  vpn: "vpn",
  checking: "...",
  unknown: "?",
};

interface Tile {
  el: HTMLAnchorElement;
  href: string;
  name: string;
  tags: string;
  isSelfHosted: boolean;
  statusEl: HTMLElement;
  statusTextEl: HTMLElement;
}

function collectTiles(): Tile[] {
  return Array.from(
    document.querySelectorAll<HTMLAnchorElement>("a.tile[data-name]"),
  ).map((el) => {
    const statusEl = el.querySelector<HTMLElement>(".status");
    const statusTextEl = el.querySelector<HTMLElement>(".status .text");
    if (!statusEl || !statusTextEl) {
      throw new Error("tile missing .status or .status .text");
    }
    const tags = el.dataset.tags ?? "";
    return {
      el,
      href: el.dataset.href ?? el.href,
      name: el.dataset.name ?? "",
      tags,
      isSelfHosted: tags.includes("Self-Hosted"),
      statusEl,
      statusTextEl,
    };
  });
}

function setTileStatus(tile: Tile, status: TileStatus): void {
  tile.statusEl.dataset.status = status;
  tile.statusEl.setAttribute("aria-label", `Status: ${status}`);
  tile.statusTextEl.textContent = STATUS_LABEL[status];
}

let tailnetPromise: Promise<boolean> | null = null;
let tailnetPromiseAt = 0;

/** Caches the (slow-ish) WebRTC-based tailnet detection for a short window so every status refresh doesn't re-run it. */
function cachedTailnetPresence(): Promise<boolean> {
  const now = Date.now();
  if (tailnetPromise && now - tailnetPromiseAt < TAILNET_IP_CACHE_MS) {
    return tailnetPromise;
  }
  tailnetPromiseAt = now;
  tailnetPromise = detectTailnetPresence({ timeoutMs: TAILNET_IP_TIMEOUT_MS });
  return tailnetPromise;
}

export function initDashboard(): void {
  const searchInput = document.getElementById("q") as HTMLInputElement | null;
  const tagSelect = document.getElementById("tag") as HTMLSelectElement | null;
  const countEl = document.getElementById("count");
  const emptyEl = document.getElementById("empty");
  const refreshBtn = document.getElementById("refresh");

  initThemeToggle({
    button: document.querySelector<HTMLButtonElement>(".topbar__toggle"),
    icon: document.querySelector<HTMLElement>(".topbar__toggleIcon"),
  });

  const tiles = collectTiles();

  const applyFilter = () => {
    const query = searchInput?.value ?? "";
    const tag = tagSelect?.value ?? "";
    let visible = 0;
    for (const tile of tiles) {
      const show = matchesFilter(tile, query, tag);
      tile.el.hidden = !show;
      if (show) visible++;
    }
    if (countEl) countEl.textContent = `${visible} / ${tiles.length}`;
    if (emptyEl) emptyEl.hidden = visible !== 0;
  };

  searchInput?.addEventListener("input", applyFilter);
  tagSelect?.addEventListener("change", applyFilter);
  applyFilter();

  window.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.activeElement !== searchInput) {
      event.preventDefault();
      searchInput?.focus();
    }
  });

  const checkStatuses = async () => {
    const visible = tiles.filter((tile) => !tile.el.hidden);
    if (visible.length === 0) return;
    for (const tile of visible) setTileStatus(tile, "checking");

    const [server, onTailnet] = await Promise.all([
      fetchServerStatuses(STATUS_TIMEOUT_MS),
      cachedTailnetPresence(),
    ]);

    await Promise.all(
      visible.map(async (tile) => {
        const serverStatus = server.apps.get(tile.href);
        const tailnetDeviceOnline = server.tailnetDeviceOnline;
        const pingRequired = !(
          serverStatus === "up" ||
          (tile.isSelfHosted && tailnetDeviceOnline === false)
        );
        const pingOk = pingRequired
          ? await pingUrl(
              tile.href,
              tile.isSelfHosted ? CLIENT_TIMEOUT_MS : STATUS_TIMEOUT_MS,
            )
          : null;

        setTileStatus(
          tile,
          resolveTileStatus({
            isSelfHosted: tile.isSelfHosted,
            serverStatus,
            tailnetDeviceOnline,
            pingOk,
            onTailnet,
          }),
        );
      }),
    );
  };

  let statusRunning = false;
  const runStatusCheck = () => {
    if (statusRunning) return;
    statusRunning = true;
    checkStatuses().finally(() => {
      statusRunning = false;
    });
  };

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      refreshBtn.classList.remove("spinning");
      void refreshBtn.offsetWidth;
      refreshBtn.classList.add("spinning");
      runStatusCheck();
    });
    refreshBtn.addEventListener("animationend", () =>
      refreshBtn.classList.remove("spinning"),
    );
  }

  let intervalId: ReturnType<typeof setInterval> | null = null;
  const startInterval = () => {
    if (intervalId !== null) return;
    intervalId = setInterval(runStatusCheck, STATUS_REFRESH_MS);
  };
  const stopInterval = () => {
    if (intervalId === null) return;
    clearInterval(intervalId);
    intervalId = null;
  };

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopInterval();
    } else if (intervalId === null) {
      runStatusCheck();
      startInterval();
    }
  });

  runStatusCheck();
  startInterval();
}
