# Survivors Beware — setup

Three pieces: a **Google Sheet + Apps Script** (the data), a **static `index.html`** (the site), and **`season.js`** (this season's cast, profiles, questions and lock rule — the only file that changes each season).
Same shape as The Veto Royale (BB) — but it needs its **own** Sheet and its **own** Apps Script deployment. Don't point this site at the Big Brother `/exec` URL: it would read and write the BB sheet.

---

## 1. Backend (Google Sheet + Apps Script)

1. Create a **new Google Sheet** (e.g. "Survivors Beware S51") — not the BB one.
2. **Extensions → Apps Script**. Delete the sample and paste in **`apps-script/Code.gs`**.
3. Add a second file: **＋ → Script**, name it **`Season`**, and paste in all of **`season.js`**. Save.
4. Run the **`setup`** function (pick it from the function dropdown → Run).
   Authorize when Google asks — it now also asks to **connect to an external service** (that's the Wikipedia auto-fill). This builds the tabs and loads Season 51: the 21 castaways with profiles (Aaliyah already recorded as 21st), 9 yes/no questions, and your usual roster with no picks yet.
5. Set your admin passphrase, kept out of the code:
   **Project Settings (⚙️) → Script Properties → Add script property**
   - Name: `ADMIN_PASSPHRASE`
   - Value: whatever you want to type when running the season (can differ from the BB one — the sites remember them separately)
6. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Deploy, copy the **Web app URL**. It must end in **`/exec`**. A **Test deployment** gives a `/dev` link instead — that only works for you while signed in to Google, so the site can't use it.

> Changed `Code.gs` or `Season` later? **Deploy → Manage deployments → edit (✏️) → Version: New → Deploy.** Same gotcha as the reunion site.

---

## 2. Frontend (the site)

1. Open **`index.html`**, find this line near the top of the script:
   ```js
   const API_URL = "";
   ```
   Paste your `/exec` URL between the quotes. Save.
2. This repo → **Settings → Pages → Deploy from branch → main / (root)**.
   Link is `https://ty1erdav1s.github.io/survivor_beware/`.

Leave `API_URL` empty and the site runs on demo data built from `season.js` — handy for previewing the look (and the picks panel) before the backend is wired.

---

## Start of a season

1. **Profiles** — ask Claude to write `season.js` for the new season (cast, ages, hometowns, tribes, short bios, questions, lock rule). Paste it into the Apps Script **Season** file, run **`setup`**, redeploy a new version, and push the repo.
   Re-running `setup` is always safe: profiles and the lock/Wikipedia settings update; names, titles and question text only fill in if blank (so hand edits survive); picks, answers, recorded vote-outs and the player list are **never** touched. Fixing a typo in a bio mid-season is just "edit, paste, run setup".
2. **Players** — **Admin → Players**: add anyone new, remove anyone sitting out. The list shows who has picks in.
3. **Picks** — send the link. Everyone picks their name, **drags the cast into boot order** (top = first out, bottom = Sole Survivor; tap a name for the profile) and **answers every circumstantial question** — Save stays disabled until all are answered, and the server rejects incomplete entries too.
4. **Lock** — picks lock automatically once `lockAfterBoots` castaways are out. Survivor: `2` (after Episode 2). Big Brother: `1` (after the first eviction). The banner on the site and in the picks panel says when. **Admin → Picks lock** can force it locked, or open it again to let a latecomer in, then set it back to Automatic.

## During the season

- **Record a vote-out** — pick the castaway; the placement pre-fills with the next open spot.
- **Made a mistake?** **Admin → Boot order** lists everyone out. **Undo** clears a placement; changing the number and **Save** moves it. A placement can only belong to one person, so to swap two, undo one first.
- **Wikipedia auto-fill** — **Admin → Check Wikipedia** reads the "Finish" column of the season's Wikipedia page and previews what it would record. **Apply** only fills castaways you haven't recorded into open placements; anything that disagrees with what you entered is shown in red and left alone. If the page is mid-edit (not in boot order), it refuses to apply.
  - Want it hands-off? In the Apps Script editor run **`installAutoSync`** once (checks every 6 hours); **`removeAutoSync`** turns it off. Heads-up: Wikipedia is often updated *during* the East Coast broadcast, so this can spoil West Coast players — the button is the safer default.
  - Finale: runners-up are placed in the order Wikipedia lists them; double-check 2nd/3rd by hand.
- **Circumstantial questions** — the **Questions** section shows every question, who said Yes/No, and the answer once resolved. **Admin → Circumstantial questions** marks Yes/No (or **Reopen** a mistake). Each correct answer is −1.
- **New phone?** A player's picks are tied to the device they first saved from. **Admin → Players → Reset** lets their next save come from any device.

## New season later

Ask Claude for a new `season.js` (new `seasonId`, e.g. `s52`), paste it into the **Season** file, run **`setup`**, redeploy. Old seasons stay in the sheet, keyed by season id.

---

## Fun stuff

All of this runs in the browser. Nothing is stored in the sheet, and none of it affects scores.

- **Jeff-isms** — a random one under the title (tap it for another), plus themed lines when saving, on errors, when picks lock, and in the footer. They're original puns on his catchphrases and are labelled "Jeff-ism". The lines live in `SKINS.survivor.fun` in `index.html`.
- **Tribal reveal** — the first time each device opens the site after a vote-out, a parchment card shows who went home, how it changed that person's score, and where they stand now. Each vote-out is shown once per device. New visitors don't get old ones replayed, and admins don't see the ones they recorded themselves.
- **Hidden immunity idol** — a small carved idol hides somewhere different each week (the same spot for everyone). Tapping it gives a reveal and confetti.
- **Next Tribal countdown** — this uses `airs` in `season.js` (Wednesdays 8pm ET, 90 minutes), and it's correct in every time zone and across daylight-saving changes. **If an episode is skipped** (holidays, sports), add the date to `airs.skip`, e.g. `skip: ['2026-11-25']`, then push; no redeploy needed.
- **Standings flair** — ▲/▼ shows how many places each player moved since the last vote-out, the leader wears the immunity necklace, and there are "On fire" and "Blindside of the week" badges for moves of 2+ places.

---

## Local sandbox (no Google needed)

`dev/local.html` runs the site against the **real `Code.gs`** with a fake spreadsheet in your browser — handy for trying changes before redeploying.

```bash
python -m http.server 8751
```

Then open `http://127.0.0.1:8751/dev/local.html`. Admin passphrase: `dev`. Add `?reset` to the URL to start over.

---

## Survivor notes

- **Placements:** first boot of 21 is placement **21**, the Sole Survivor is **1**.
- **Picks after the premiere:** Aaliyah is already recorded as out, so anyone submitting now knows that. To make it a pre-premiere pool instead, remove `out:21` from her entry in `season.js` before the first `setup` (or **Undo** her in Boot order).
- **Two sites, one domain:** both pools live on `ty1erdav1s.github.io`, so this site stores its browser data under `sb_` keys (BB uses `vr_`) to keep passphrases and edit tokens from colliding.

---

## Notes on the security model

- Reads are public — anyone with the link sees standings, picks and answers. That's intended.
- Admin actions are gated by the passphrase, **verified server-side in `Code.gs`**, not in the page. A determined person could POST to the endpoint, but nothing writes without the passphrase or a valid player token.
- The passphrase lives only in Script Properties and (optionally) your own browser — never in the repo.
