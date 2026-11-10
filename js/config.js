// ─────────────────────────────────────────────────────────────
//  League settings — this is the only file you need to edit
//  between seasons.
// ─────────────────────────────────────────────────────────────
window.FUTSAL_CONFIG = {
  leagueName: "Iona Futsal League",
  shortName: "Iona Futsal",
  season: "2026-27",

  // Google Sheet → File → Share → Publish to web.
  // `base` is the published link up to and including "/pub".
  // Each tab's number is the "gid=" value in its URL.
  sheet: {
    base: "https://docs.google.com/spreadsheets/d/e/2PACX-1vR2zHnWn0w2AZ2TpbBniTby96VlZuU0pwk35nUD1XFmoRd8eVHLUaQd3To1a0c-jQ/pub",
    tabs: {
      standings: 850902682,
      players: 1385558400,
      potw: 1171657962,
    },
  },

  // How often an open page re-checks the sheet (minutes).
  refreshMinutes: 5,
};
