# Survivors Beware — setup

Two pieces: a **Google Sheet + Apps Script** (the data) and a **static `index.html`** (the site).
Same shape as The Veto Royale (BB) — but it needs its **own** Sheet and its **own** Apps Script deployment. Don't point this site at the Big Brother `/exec` URL: it would read and write the BB sheet.

---

## 1. Backend (Google Sheet + Apps Script)

1. Create a **new Google Sheet** (e.g. "Survivors Beware S51") — not the BB one.
2. **Extensions → Apps Script**. Delete the sample, paste in **`Code.gs`**, Save.
3. Run the **`setup`** function once (pick it from the function dropdown → Run).
   Authorize when Google asks. This builds all the tabs and loads Season 51: the 21-person cast (Aaliyah already recorded as 21st), 9 yes/no questions, and your usual roster with no picks yet.
4. Set your admin passphrase, kept out of the code:
   **Project Settings (⚙️) → Script Properties → Add script property**
   - Name: `ADMIN_PASSPHRASE`
   - Value: whatever you want to type when running the season (can differ from the BB one — the sites remember them separately)
5. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Deploy, copy the **Web app URL** (ends in `/exec`).

> Changed `Code.gs` later? **Deploy → Manage deployments → edit (✏️) → Version: New → Deploy.** Same gotcha as the reunion site.

---

## 2. Frontend (the site)

1. Open **`index.html`**, find this line near the top of the script:
   ```js
   const API_URL = "";
   ```
   Paste your `/exec` URL between the quotes. Save.
2. Host it exactly like the reunion site:
   This repo → **Settings → Pages → Deploy from branch → main / (root)**.
   Link is `https://ty1erdav1s.github.io/survivor_beware/`.

Leave `API_URL` empty and the site runs on built-in demo data — handy for previewing the look before the backend is wired.

---

## Running a season

- **Players:** open the link → **Submit / edit my picks** → pick their name, rank the cast, answer the yes/no questions. First save on a device locks their name to that browser (the edit token). They can re-open and edit from the same device.
- **You:** **Admin** → type the passphrase (remembered on your device) → record a vote-out, resolve a circumstantial question, add/remove a player, bump the episode number. Standings, win odds, and the memory wall recompute the moment you save.

Add players *before* asking people to submit, so their name is in the dropdown.

---

## New season later

Change `CURRENT` at the top of `Code.gs` (e.g. `s52`), add a matching row to the **seasons** tab and its **cast**/**questions**. Old seasons stay in the sheet, keyed by season id. The rest of the code doesn't change.

---

## Survivor notes

- **Placements:** first boot of 21 is placement **21**, the Sole Survivor is **1**. The admin panel pre-fills the next open placement.
- **Picks after the premiere:** Aaliyah is already recorded as out, so anyone submitting now knows that. To make it a pre-premiere pool instead, clear her `actual` in the **cast** tab (or in `setup()` before running it).
- **Two sites, one domain:** both pools live on `ty1erdav1s.github.io`, so this site stores its browser data under `sb_` keys (BB uses `vr_`) to keep passphrases and edit tokens from colliding.

---

## Notes on the security model

- Reads are public — anyone with the link sees standings. That's intended.
- Admin actions are gated by the passphrase, **verified server-side in `Code.gs`**, not in the page. A determined person could POST to the endpoint, but nothing writes without the passphrase or a valid player token.
- The passphrase lives only in Script Properties and (optionally) your own browser — never in the repo.
