# Survivors Beware

A for-fun Survivor prediction pool (Season 51). Rank the castaways by
predicted finish — lowest score wins. Static site on GitHub Pages, backed
by a Google Sheet via Google Apps Script. Players submit and edit their
own picks; the admin runs the season from the UI.

Shares its engine with
[reality_tv_fun_n_games](https://github.com/ty1erdav1s/reality_tv_fun_n_games)
(The Veto Royale, Big Brother): `index.html`, `apps-script/Code.gs` and `dev/`
are identical in both repos apart from each site's `API_URL`, so a change to
one ports by copying the files. Everything Survivor-specific — cast, profiles,
questions, lock rule, and the `survivor` skin — is in `season.js`.

- **`index.html`** — the site. Deploy to GitHub Pages.
- **`season.js`** — this season's cast, profiles, questions and lock rule. The only file that changes each season; also pasted into Apps Script as `Season`.
- **`apps-script/Code.gs`** — the backend. Paste into Google Apps Script, run `setup()`.
- **`dev/local.html`** — local sandbox that runs the real backend against a fake sheet in your browser.
- **`SETUP.md`** — deploy guide plus the start-of-season and during-season checklists.

Leave `API_URL` empty in `index.html` to preview on built-in demo data;
paste your Apps Script `/exec` URL to go live.
