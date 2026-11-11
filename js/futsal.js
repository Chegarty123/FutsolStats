// Shared data loading + UI helpers for every page.
// Exposes a single global: window.Futsal
(function () {
  "use strict";
  const C = window.FUTSAL_CONFIG;

  // ── DOM helper ─────────────────────────────────────────────
  // el("a", { class: "x", href: "/" }, "text", childNode)
  // Strings are always inserted as text, never as HTML.
  function el(tag, props, ...children) {
    const node = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === "class") node.className = v;
        else if (k === "text") node.textContent = v;
        else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? "" : v);
      }
    }
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      node.append(c instanceof Node ? c : String(c));
    }
    return node;
  }

  // ── CSV ────────────────────────────────────────────────────
  // RFC 4180: handles quoted commas, escaped quotes ("") and
  // line breaks inside quoted cells.
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else quoted = false;
        } else field += c;
      } else if (c === '"') quoted = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); rows.push(row);
        row = []; field = "";
      } else field += c;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  // "Goals " → "goals", "G + A" → "g+a", "Form (Last 5)" → "form"
  const normHeader = (h) =>
    String(h).toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9+]/g, "");

  // Columns are found by header name, so the sheet's column order
  // can change freely. Each field lists the header names it accepts.
  const SCHEMAS = {
    standings: {
      key: "club",
      fields: {
        position: ["position", "pos", "rank"],
        club: ["club", "team"],
        mp: ["mp", "played", "p", "gp"],
        w: ["w", "won", "wins"],
        d: ["d", "drawn", "draws"],
        l: ["l", "lost", "losses"],
        gf: ["gf", "for", "goalsfor"],
        ga: ["ga", "against", "goalsagainst"],
        gd: ["gd", "diff", "goaldifference"],
        pts: ["pts", "points"],
        form: ["form", "last5"],
      },
    },
    players: {
      key: "player",
      fields: {
        player: ["player", "name"],
        team: ["team", "club"],
        goals: ["goals", "goal", "g"],
        assists: ["assists", "assist", "a"],
        ga: ["g+a", "ga", "goals+assists"],
        latest: ["latestrating", "lastrating", "latest", "matchrating"],
        season: ["seasonrating", "avgrating", "averagerating", "rating"],
      },
    },
    potw: {
      key: "player",
      fields: {
        player: ["player", "name"],
        date: ["date"],
        week: ["week", "wk"],
        team: ["team", "club"],
        goals: ["goals", "goal", "g"],
        assists: ["assists", "assist", "a"],
        ga: ["g+a", "ga", "goals+assists"],
        rating: ["rating", "latestrating", "matchrating", "weekrating"],
      },
    },
  };

  function toRecords(rows, schema) {
    if (!rows.length) return [];
    const headers = rows[0].map(normHeader);
    const index = {};
    for (const [name, aliases] of Object.entries(schema.fields)) {
      index[name] = headers.findIndex((h) => aliases.includes(h));
    }
    const out = [];
    for (const row of rows.slice(1)) {
      if (row.every((c) => !c.trim())) break; // first blank row = end of data
      const rec = {};
      for (const [name, i] of Object.entries(index)) rec[name] = i >= 0 ? (row[i] || "").trim() : "";
      if (rec[schema.key]) out.push(rec);
    }
    return out;
  }

  // ── Loading ────────────────────────────────────────────────
  // 1. Google Sheet directly (it allows cross-origin requests — no proxy).
  // 2. If that fails: the newest of the copy saved in this browser
  //    or the snapshot in /data (refreshed by the GitHub Action).
  const STORE = "futsal:v2:";

  async function fetchText(url, ms = 10000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.text();
    } finally {
      clearTimeout(timer);
    }
  }

  // An unpublished sheet returns a Google sign-in HTML page instead of CSV.
  const looksLikeCSV = (t) => typeof t === "string" && !/^\s*</.test(t);

  function readCache(tab) {
    try {
      const v = JSON.parse(localStorage.getItem(STORE + tab));
      return v && typeof v.text === "string" ? v : null;
    } catch { return null; }
  }
  function writeCache(tab, text) {
    try { localStorage.setItem(STORE + tab, JSON.stringify({ text, at: Date.now() })); } catch { /* storage unavailable */ }
  }
  async function readSnapshot(tab) {
    try {
      const res = await fetch(`data/${tab}.csv`, { cache: "no-store" });
      if (!res.ok) return null;
      const text = await res.text();
      if (!looksLikeCSV(text)) return null;
      return { text, at: Date.parse(res.headers.get("last-modified")) || 0 };
    } catch { return null; }
  }

  async function load(tab) {
    const schema = SCHEMAS[tab];
    const result = (text, source, at) => ({ tab, source, at, records: toRecords(parseCSV(text), schema) });
    const url = `${C.sheet.base}?gid=${C.sheet.tabs[tab]}&single=true&output=csv&t=${Math.floor(Date.now() / 60000)}`;
    try {
      const text = await fetchText(url);
      if (!looksLikeCSV(text)) throw new Error("Sheet didn't return CSV — is it still published to the web?");
      writeCache(tab, text);
      return result(text, "live", Date.now());
    } catch (err) {
      console.warn(`[futsal] live load failed for "${tab}":`, err);
      const backups = [readCache(tab), await readSnapshot(tab)].filter(Boolean);
      if (backups.length) {
        const best = backups.sort((a, b) => (b.at || 0) - (a.at || 0))[0];
        return result(best.text, "saved", best.at);
      }
      throw new Error("Couldn't reach the league spreadsheet. Check your connection and try again.");
    }
  }

  // ── Small formatting helpers ───────────────────────────────
  const num = (v) => {
    const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };
  const signed = (v) => (num(v) > 0 ? "+" + num(v) : String(num(v)));
  const gPlusA = (r) => (r.ga !== "" ? num(r.ga) : num(r.goals) + num(r.assists));
  // Game ratings: a blank cell means "not rated yet" (null), never 0.
  const rating = (v) => {
    const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? Math.round(n * 10) / 10 : null; // 1 decimal, like it's shown
  };
  // Sofascore-style colour bands (colours live in css/styles.css):
  //   9.0+ blue · 8.0–8.9 cyan · 7.0–7.9 green · 6.5–6.9 yellow
  //   6.0–6.4 orange · below 6.0 red · blank = grey
  // rating() already rounds to 1 decimal, so the colour always matches the number shown.
  function ratingTier(x) {
    return x >= 9 ? "excellent" : x >= 8 ? "verygood" : x >= 7 ? "good"
      : x >= 6.5 ? "average" : x >= 6 ? "below" : "poor";
  }
  function ratingBadge(v) {
    const r = rating(v);
    if (r == null) return el("span", { class: "rating none", title: "Not rated yet", text: "–" });
    return el("span", { class: "rating " + ratingTier(r), text: r.toFixed(1) });
  }

  // A Player of the Week winner's rating: the POTW sheet's own Rating
  // column if it has one, otherwise the player's Latest Rating from the
  // player stats sheet (matched by name, ignoring case and spaces).
  const sameName = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  function potwRating(winner, players) {
    const own = rating(winner.rating);
    if (own != null) return own;
    const p = (players || []).find((x) => sameName(x.player, winner.player));
    return p ? rating(p.latest) : null;
  }
  const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const fmtDateTime = (t) =>
    new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  function teamBadge(name) {
    // In tables on phones only the colour square shows; the title keeps the name available.
    return el("span", { class: "team", "data-team": (name || "").trim().toLowerCase(), title: name || null },
      el("span", { class: "team-name", text: name || "—" }));
  }

  // Leaders for a numeric stat, handling ties. Returns null when nobody has scored.
  function leaders(records, valueOf) {
    let best = 0;
    for (const r of records) best = Math.max(best, valueOf(r));
    if (best <= 0) return null;
    return { value: best, rows: records.filter((r) => valueOf(r) === best) };
  }
  function namesLabel(rows, key = "player") {
    const names = rows.map((r) => r[key]);
    if (names.length <= 2) return names.join(" & ");
    return `${names[0]} & ${names.length - 1} others`;
  }

  // ── Shared UI ──────────────────────────────────────────────
  function message(kind, title, text, action) {
    return el("div", { class: `notice notice-${kind}`, role: kind === "error" ? "alert" : null },
      el("p", { class: "notice-title", text: title }),
      text && el("p", { class: "notice-text", text }),
      action && el("button", { class: "btn", type: "button", onclick: action.fn, text: action.label }),
    );
  }

  function skeleton(lines = 6) {
    return el("div", { class: "skeleton", "aria-hidden": "true" },
      Array.from({ length: lines }, () => el("div", { class: "skeleton-bar" })));
  }

  const NAV = [
    ["standings", "Standings", "standings.html"],
    ["players", "Players", "PlayerStats.html"],
    ["potw", "Player of the Week", "PlayerOfTheWeek.html"],
  ];

  function mountChrome(active) {
    const nav = document.getElementById("site-nav");
    nav.replaceChildren(
      el("div", { class: "nav-inner" },
        el("a", { class: "brand", href: "index.html", "aria-current": active === "home" ? "page" : null },
          el("span", { class: "brand-ball", "aria-hidden": "true", text: "⚽" }),
          el("span", { text: C.leagueName })),
        el("nav", { class: "nav-links", "aria-label": "Main" },
          NAV.map(([id, label, href]) =>
            el("a", { href, "aria-current": id === active ? "page" : null, text: label }))),
      ),
    );
    document.querySelectorAll("[data-season]").forEach((n) => (n.textContent = C.season));
    document.body.append(
      el("footer", { class: "site-foot" },
        el("span", { text: `${C.leagueName} · Season ${C.season}` }),
        el("span", { text: "Stats come straight from the league's Google Sheet" })),
    );
  }

  function renderStatus(statusEl, results, refresh) {
    const saved = results.filter((r) => r.source !== "live");
    let cls, text;
    if (!saved.length) {
      cls = "ok";
      text = "Live · updated " + fmtTime(Date.now());
    } else {
      cls = "warn";
      const oldest = Math.min(...saved.map((r) => r.at || Infinity));
      text = "Couldn't reach the sheet — showing saved stats" +
        (Number.isFinite(oldest) && oldest > 0 ? " from " + fmtDateTime(oldest) : "");
    }
    statusEl.replaceChildren(
      el("span", { class: "status-dot " + cls, "aria-hidden": "true" }),
      el("span", { text }),
      el("button", { class: "btn-link", type: "button", onclick: refresh, text: "Refresh" }),
    );
  }

  // Wires up a page: chrome, loading, error state, refresh button and
  // periodic auto-refresh. `render(main, data, isRefresh)` gets an
  // object keyed by tab; a tab that couldn't load at all is null.
  function page({ active, tabs, render }) {
    mountChrome(active);
    const main = document.getElementById("content");
    const statusEl = document.getElementById("status");
    let busy = false;
    let hasContent = false;

    async function run() {
      if (busy) return;
      busy = true;
      if (!hasContent) main.replaceChildren(skeleton());
      statusEl.replaceChildren(el("span", { class: "status-dot loading", "aria-hidden": "true" }), el("span", { text: "Loading stats…" }));

      const settled = await Promise.allSettled(tabs.map(load));
      const ok = settled.filter((s) => s.status === "fulfilled").map((s) => s.value);
      busy = false;

      if (!ok.length) {
        const reason = location.protocol === "file:"
          ? "This page was opened straight from a file, and Google blocks that. Run  node scripts/serve.mjs  in this folder and open http://localhost:8000 instead. Once the site is hosted online this isn't an issue."
          : settled[0].reason?.message || "Something went wrong.";
        if (!hasContent) main.replaceChildren(message("error", "Couldn't load the stats", reason, { label: "Try again", fn: run }));
        statusEl.replaceChildren(
          el("span", { class: "status-dot bad", "aria-hidden": "true" }),
          el("span", { text: "Offline" }),
          el("button", { class: "btn-link", type: "button", onclick: run, text: "Retry" }));
        return;
      }

      const data = Object.fromEntries(tabs.map((t) => [t, null]));
      for (const r of ok) data[r.tab] = r.records;
      try {
        render(main, data, hasContent);
        hasContent = true;
      } catch (err) {
        console.error(err);
        main.replaceChildren(message("error", "Something went wrong showing the stats", err.message));
      }
      renderStatus(statusEl, ok, run);
    }

    run();
    const every = (C.refreshMinutes || 5) * 60 * 1000;
    setInterval(() => document.visibilityState === "visible" && run(), every);
  }

  window.Futsal = {
    config: C, el, parseCSV, load, num, signed, gPlusA, rating, ratingTier, ratingBadge, potwRating, teamBadge,
    leaders, namesLabel, message, page,
  };
})();
