/**********************************************************************
 * REALITY-TV PREDICTION POOL — backend (Survivors Beware / The Veto Royale)
 * Identical in both repos; everything show-specific lives in Season.gs.
 * ------------------------------------------------------------------
 * One Google Sheet is the data store. This script exposes it as a
 * tiny JSON API that the GitHub Pages site reads from and writes to.
 * Nobody edits the sheet by hand.
 *
 * FILES IN THE APPS SCRIPT PROJECT
 *   Code    — this file (the engine; rarely changes)
 *   Season  — a paste of season.js from the repo (cast, profiles,
 *             questions, theme, lock rule). Swap it each season.
 *
 * ONE-TIME SETUP
 *   1. Extensions > Apps Script, paste this file as Code and season.js
 *      as a second Script file (+ > Script, not HTML) named Season, Save.
 *      Or skip the second file: paste season.js at the bottom of this one.
 *   2. Run setup()  (authorize when prompted). Builds the tabs and
 *      loads the season. Safe to re-run any time: it updates
 *      profiles/questions and never touches picks, answers or
 *      recorded vote-outs.
 *   3. Set your admin passphrase:
 *        Project Settings (gear) > Script Properties > Add property
 *        Name: ADMIN_PASSPHRASE   Value: whatever-you-choose
 *      (Kept out of this code on purpose so the source is shareable.)
 *   4. Deploy > New deployment > Web app
 *        Execute as: Me       Who has access: Anyone
 *      Copy the /exec URL and paste it into API_URL in index.html.
 *
 * SECURITY MODEL (honest version)
 *   - Reads are public (anyone with the URL can GET the standings).
 *   - Player submits are gated by a per-name edit token: the first
 *     submission for a name issues a token stored in that person's
 *     browser; later edits must present it. Stops casual overwrites,
 *     not a determined attacker — fine for a family game.
 *   - Admin writes require the passphrase, checked HERE on the server.
 *     A login on the page alone would be decoration; this is the real
 *     gate. The passphrase travels in the POST body over HTTPS.
 *********************************************************************/

const SS = SpreadsheetApp.getActiveSpreadsheet();

// New columns only ever go on the END of a tab, so older sheets upgrade in place.
const TABS = {
  seasons:   ['seasonId','show','title','episode','castSize','locked','theme','lockAfterBoots','lockNote','wikiTitle'],
  cast:      ['seasonId','castId','name','occ','actual','age','home','tribe','bio'],
  players:   ['seasonId','name','isAI','tokenHash','submittedAt'],
  questions: ['seasonId','qId','text','isTrue'],
  answers:   ['seasonId','name','qId','answer'],
  picks:     ['seasonId','name','castId','rank']
};

// Resolved at call time: Season.gs may load after this file.
function season_(){
  if (typeof SEASON === 'undefined')
    throw new Error('No season data found. Add a Script file (not HTML) named "Season" containing season.js, '
                  + 'or paste season.js at the very bottom of this file — then Save and try again.');
  return SEASON;
}
function sid_(){ return season_().seasonId; }

/* ============================ ROUTING ============================ */

function doGet(e){
  const action = (e && e.parameter && e.parameter.action) || 'getSeason';
  if (action === 'getSeason') return json_({ ok:true, data:getSeason_(sid_()) });
  return json_({ ok:false, error:'unknown action' });
}

function doPost(e){
  const lock = LockService.getScriptLock();
  lock.tryLock(20000);
  try {
    const b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = b.action;

    if (action === 'submitEntry') return json_(submitEntry_(b));

    const adminActions = {
      addPlayer, removePlayer, resetToken, enterEviction, undoEviction,
      resolveQuestion, setEpisode, setLockMode, checkWikipedia, applyWikipedia
    };
    if (adminActions[action]) {
      if (!checkPass_(b.pass)) return json_({ ok:false, error:'Wrong passphrase' });
      return json_(adminActions[action](b));
    }
    return json_({ ok:false, error:'unknown action' });
  } catch (err) {
    return json_({ ok:false, error:String(err) });
  } finally {
    lock.releaseLock();
  }
}

/* ============================ READ ============================== */

function getSeason_(sid){
  const s = rows_('seasons').find(r => r.seasonId === sid) || {};
  const cast = rows_('cast').filter(c => c.seasonId === sid)
    .map(c => ({ id:Number(c.castId), name:c.name, occ:c.occ,
                 actual:blank_(c.actual) ? null : Number(c.actual),
                 age:blank_(c.age) ? null : Number(c.age),
                 home:c.home || '', tribe:c.tribe || '', bio:c.bio || '' }))
    .sort((a,b) => a.id - b.id);

  const questions = rows_('questions').filter(q => q.seasonId === sid)
    .map(q => ({ qId:q.qId, text:q.text, isTrue:blank_(q.isTrue) ? null : String(q.isTrue) }));

  const answers = rows_('answers').filter(a => a.seasonId === sid);
  const picks   = rows_('picks').filter(p => p.seasonId === sid);

  const players = rows_('players').filter(p => p.seasonId === sid).map(p => {
    const ranks = {}, mine = {};
    picks.filter(x => x.name === p.name).forEach(x => ranks[Number(x.castId)] = Number(x.rank));
    let bonus = 0;
    answers.filter(x => x.name === p.name).forEach(x => {
      mine[x.qId] = String(x.answer);
      const q = questions.find(q => q.qId === x.qId);
      if (q && q.isTrue !== null && String(x.answer) === q.isTrue) bonus -= 1;
    });
    return {
      name:p.name,
      isAI: p.isAI === true || String(p.isAI).toUpperCase() === 'TRUE',
      bonus,
      ranks,
      answers: mine,
      submitted: Object.keys(ranks).length > 0
    };
  });

  let theme = null;
  try { theme = s.theme ? JSON.parse(s.theme) : null; } catch (_) {}
  const lk = lockState_(s, cast);

  return {
    season: {
      seasonId: sid, show: s.show, title: s.title,
      episode: Number(s.episode) || 1,
      castSize: Number(s.castSize) || cast.length,
      locked: lk.locked, lockMode: lk.mode, lockAfterBoots: lk.after,
      lockNote: s.lockNote || '', bootsSoFar: lk.boots,
      wikiTitle: s.wikiTitle || '',
      theme
    },
    cast, players, questions
  };
}

// 'auto' locks once lockAfterBoots castaways are out; 'locked'/'open' are admin overrides.
function lockState_(s, cast){
  const mode = lockMode_(s.locked);
  const after = Number(s.lockAfterBoots) || 0;
  const boots = cast.filter(c => c.actual !== null).length;
  const auto = after > 0 && boots >= after;
  return { mode, after, boots, locked: mode === 'locked' || (mode === 'auto' && auto) };
}
function lockMode_(v){
  const t = String(v).toLowerCase();
  if (t === 'locked' || t === 'true') return 'locked';   // 'true' = legacy checkbox value
  if (t === 'open') return 'open';
  return 'auto';
}

/* ========================= PLAYER WRITE ========================= */

function submitEntry_(b){
  const sid = sid_();
  const season = getSeason_(sid).season;
  if (season.locked) return { ok:false, error:'Picks are locked for this season' };

  const me = rows_('players').filter(p => p.seasonId === sid).find(p => p.name === b.name);
  if (!me) return { ok:false, error:'That name is not on the roster yet — ask the admin to add you' };

  // edit-token gate
  let issued = null;
  if (me.tokenHash) {
    if (hash_(b.token || '') !== me.tokenHash)
      return { ok:false, error:'This name was already submitted from another device — ask the admin to reset it' };
  } else {
    issued = newToken_();
  }

  // validate ranking is a full 1..N permutation of the current cast
  const cast = rows_('cast').filter(c => c.seasonId === sid);
  const N = cast.length;
  const ranks = b.ranks || {};
  const vals = cast.map(c => Number(ranks[c.castId]));
  if (vals.some(v => !(v >= 1 && v <= N)) || new Set(vals).size !== N)
    return { ok:false, error:'Rank everyone in the cast exactly once, 1 to ' + N };

  // every circumstantial question needs a Yes or No
  const qs = rows_('questions').filter(q => q.seasonId === sid);
  const ans = b.answers || {};
  const missing = qs.filter(q => ans[q.qId] !== 'Yes' && ans[q.qId] !== 'No').length;
  if (missing) return { ok:false, error:'Answer every circumstantial question (' + missing + ' left)' };

  replaceRows_('picks', sid, b.name, cast.map(c => [sid, b.name, Number(c.castId), Number(ranks[c.castId])]));
  replaceRows_('answers', sid, b.name, qs.map(q => [sid, b.name, q.qId, ans[q.qId]]));

  setCell_('players', o => o.seasonId === sid && o.name === b.name, 'submittedAt', new Date().toISOString());
  if (issued) setCell_('players', o => o.seasonId === sid && o.name === b.name, 'tokenHash', hash_(issued));

  return { ok:true, token:issued };   // raw token returned only the first time
}

/* ========================= ADMIN WRITES ======================== */

function addPlayer(b){
  const sid = sid_(), name = String(b.name || '').trim();
  if (!name) return { ok:false, error:'Name required' };
  if (rows_('players').some(p => p.seasonId === sid && p.name === name))
    return { ok:false, error:'That player already exists' };
  tab_('players').appendRow([sid, name, !!b.isAI, '', '']);
  return { ok:true };
}

function removePlayer(b){
  const sid = sid_(), name = String(b.name || '');
  ['players','picks','answers'].forEach(t => replaceRows_(t, sid, name, []));
  return { ok:true };
}

// Lets a player edit from a new device: the next save from anywhere issues a fresh token.
function resetToken(b){
  const sid = sid_();
  const ok = setCell_('players', o => o.seasonId === sid && o.name === b.name, 'tokenHash', '');
  return ok ? { ok:true } : { ok:false, error:'Player not found' };
}

// Also used to correct a placement: re-recording a castaway overwrites their old one.
function enterEviction(b){
  const sid = sid_(), id = Number(b.castId), place = Number(b.placement);
  const cast = rows_('cast').filter(c => c.seasonId === sid);
  if (!(place >= 1 && place <= cast.length && place === Math.floor(place)))
    return { ok:false, error:'Placement must be a whole number from 1 to ' + cast.length };
  const clash = cast.find(c => !blank_(c.actual) && Number(c.actual) === place && Number(c.castId) !== id);
  if (clash) return { ok:false, error:ord_(place) + ' is already ' + clash.name + ' — undo them first' };
  const ok = setCell_('cast', o => o.seasonId === sid && Number(o.castId) === id, 'actual', place);
  return ok ? { ok:true } : { ok:false, error:'Not found in the cast' };
}

function undoEviction(b){
  setCell_('cast', o => o.seasonId === sid_() && Number(o.castId) === Number(b.castId), 'actual', '');
  return { ok:true };
}

// isTrue '' reopens a question.
function resolveQuestion(b){
  const v = String(b.isTrue || '');
  if (v !== 'Yes' && v !== 'No' && v !== '') return { ok:false, error:'Answer must be Yes, No or blank' };
  setCell_('questions', o => o.seasonId === sid_() && o.qId === b.qId, 'isTrue', v);
  return { ok:true };
}

function setEpisode(b){
  setCell_('seasons', o => o.seasonId === sid_(), 'episode', Number(b.episode));
  return { ok:true };
}

function setLockMode(b){
  const mode = String(b.mode || '');
  if (['auto','locked','open'].indexOf(mode) < 0) return { ok:false, error:'Unknown lock mode' };
  setCell_('seasons', o => o.seasonId === sid_(), 'locked', mode);
  return { ok:true };
}

/* ====================== WIKIPEDIA VOTE-OUTS ===================== */
// Reads the result column of the season's contestants table on Wikipedia.
// Survivor tables list the first boot at the top; Big Brother tables list the
// winner at the top (Season.gs wikiOrder: 'firstOutLast'). Either way, the k-th
// person out (0-based) placed castSize - k. checkWikipedia writes nothing;
// applyWikipedia only fills castaways with no placement yet into free
// placements — it never overwrites something you recorded by hand.

function checkWikipedia(){ return wikiPlan_(); }

function applyWikipedia(){
  const plan = wikiPlan_();
  if (!plan.ok) return plan;
  if (!plan.inOrder) return { ok:false, error:'Wikipedia table is not in boot order right now — record by hand', plan };
  const sid = sid_();
  let applied = 0;
  plan.rows.filter(r => r.status === 'new').forEach(r => {
    setCell_('cast', o => o.seasonId === sid && Number(o.castId) === r.castId, 'actual', r.placement);
    applied++;
  });
  return Object.assign(plan, { applied });
}

// Optional hands-off mode: run installAutoSync() once from the editor.
// Wikipedia is often edited during the East Coast broadcast, so this can
// spoil West Coast viewers — use the admin button instead if that matters.
function autoSyncWikipedia(){ applyWikipedia(); }
function installAutoSync(){
  removeAutoSync();
  ScriptApp.newTrigger('autoSyncWikipedia').timeBased().everyHours(6).create();
}
function removeAutoSync(){
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'autoSyncWikipedia')
    .forEach(t => ScriptApp.deleteTrigger(t));
}

function wikiPlan_(){
  const sid = sid_();
  const s = rows_('seasons').find(r => r.seasonId === sid) || {};
  const title = s.wikiTitle || season_().wikiTitle;
  if (!title) return { ok:false, error:'No Wikipedia page set for this season' };

  let parsed;
  try { parsed = parseWikiFinishes_(fetchWikitext_(title), season_().wikiOrder === 'firstOutLast'); }
  catch (err) { return { ok:false, error:String(err.message || err) }; }

  const cast = rows_('cast').filter(c => c.seasonId === sid);
  const size = Number(s.castSize) || cast.length;
  const rows = [], unmatched = [];
  parsed.finished.forEach((r, k) => {
    const placement = size - k;
    const c = matchCast_(cast, r.first, r.last);
    if (!c) { unmatched.push((r.first + ' ' + r.last).trim()); return; }
    const current = blank_(c.actual) ? null : Number(c.actual);
    const holder = cast.find(o => o !== c && !blank_(o.actual) && Number(o.actual) === placement);
    const status = current === placement ? 'same'
                 : current !== null ? 'conflict'
                 : holder ? 'conflict' : 'new';
    rows.push({ castId:Number(c.castId), name:c.name, placement, finish:r.finish, current,
                note: holder && current === null ? ord_(placement) + ' is recorded as ' + holder.name : '',
                status });
  });
  return { ok:true, title, inOrder:parsed.inOrder, rows, unmatched };
}

function fetchWikitext_(title){
  const url = 'https://en.wikipedia.org/w/api.php?action=parse&prop=wikitext&formatversion=2&format=json&origin=*&page='
            + encodeURIComponent(title);
  const r = UrlFetchApp.fetch(url, { muteHttpExceptions:true,
    headers:{ 'Api-User-Agent':'SurvivorsBeware/1.0 (family prediction pool)' } });
  if (r.getResponseCode() !== 200) throw new Error('Wikipedia returned HTTP ' + r.getResponseCode());
  const j = JSON.parse(r.getContentText());
  if (j.error) throw new Error('Wikipedia: ' + j.error.info);
  return j.parse.wikitext;
}

const FINISH_RE_ = /\d+(?:st|nd|rd|th)\s+voted\s+out|\{\{\s*evicted\s*\|\s*\d+|medically\s+evacuated|evacuated|\bquit\b|expelled|eliminated|lost\s+(?:the\s+)?(?:fire|challenge|duel)|sole\s+survivor|\bwinner\b|(?:co-)?runner-up/i;
const OPEN_RE_ = /participating|\{\{\s*tba\b/i;

function parseWikiFinishes_(text, firstOutLast){
  const rows = [];
  let carry = null, carryLeft = 0;          // a result cell with rowspan covers the rows below it
  contestantTable_(text).split(/\n\|-/).forEach(seg => {
    const name = rowName_(seg);
    if (!name) return;
    const lines = seg.replace(/^\s*![^\n]*/, '').split('\n');   // skip the name cell itself
    let status = null;
    for (const line of lines) {
      const m = line.match(FINISH_RE_);
      if (m || OPEN_RE_.test(line)) {
        status = m ? { out:true, finish:m[0].replace(/\{\{\s*evicted\s*\|\s*(\d+)/i, 'Evicted day $1') } : { out:false };
        const span = line.match(/rowspan\s*=\s*"?(\d+)/i);
        carry = status; carryLeft = span ? Number(span[1]) - 1 : 0;
        break;
      }
    }
    if (!status && carryLeft > 0) { status = carry; carryLeft--; }
    rows.push({ first:name.first, last:name.last, out:!!(status && status.out), finish:(status && status.finish) || '' });
  });
  if (firstOutLast) rows.reverse();

  const out = { finished:[], inOrder:true };
  let sawOpen = false;
  rows.forEach(r => {
    if (!r.out) { sawOpen = true; return; }
    if (sawOpen) out.inOrder = false;       // someone out listed among people still playing
    out.finished.push(r);
  });
  return out;
}

// The contestants table: captioned "contestants"/"houseguests", else the first with a Finish/Result column.
function contestantTable_(text){
  const tables = [];
  for (let i = text.indexOf('{|'); i >= 0; i = text.indexOf('{|', i + 2)) {
    const end = text.indexOf('\n|}', i);
    tables.push(text.slice(i, end < 0 ? undefined : end));
    if (end < 0) break;
    i = end;
  }
  const t = tables.find(t => /\n\|\+[^\n]*(contestants|houseguests|castaways)/i.test(t))
         || tables.find(t => /\n![^\n]*\b(Finish|Result)\b/.test(t));
  if (!t) throw new Error('Could not find the contestants table');
  return t;
}

function rowName_(seg){
  const sn = seg.match(/\{\{\s*sortname\s*\|([^|}]*)\|([^|}]*)/i);
  if (sn) return { first:sn[1].trim(), last:sn[2].trim() };
  const hd = seg.match(/^\s*!([^\n]*)/);                            // plain "! Name" header cell
  if (!hd || /scope\s*=\s*"?col/i.test(hd[1])) return null;
  let txt = hd[1].split(/<br\s*\/?>/i)[0]                                 // "Angela Murray<br />Big Brother 26"
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1').replace(/\{\{[^}]*\}\}/g, '').replace(/<[^>]*>/g, '');
  if (txt.indexOf('|') >= 0) txt = txt.slice(txt.lastIndexOf('|') + 1);   // drop cell attributes
  const parts = txt.replace(/'''?/g, '').trim().split(/\s+/).filter(Boolean);
  return parts.length >= 2 ? { first:parts.slice(0, -1).join(' '), last:parts[parts.length - 1] } : null;
}

function matchCast_(cast, first, last){
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/["'“”‘’]/g, '').toLowerCase().trim();
  const L = norm(last).split(/\s+/).pop();
  const hits = cast.filter(c => norm(c.name).split(/\s+/).pop() === L);
  if (hits.length <= 1) return hits[0] || null;
  const F = norm(first);
  return hits.find(c => F.indexOf(norm(c.name).split(/\s+/)[0]) >= 0) || null;
}

/* =========================== HELPERS =========================== */

function json_(o){
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}
const headerChecked_ = {};
function tab_(name){
  let sh = SS.getSheetByName(name);
  if (!sh) { sh = SS.insertSheet(name); sh.appendRow(TABS[name]); headerChecked_[name] = true; return sh; }
  if (!headerChecked_[name]) {                     // older sheet? append any new columns to the header
    const head = TABS[name];
    const have = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
    const isPrefix = have.every((h, i) => h === '' || h === head[i]);
    if (isPrefix && have.filter(h => h !== '').length < head.length)
      sh.getRange(1, 1, 1, head.length).setValues([head]);
    headerChecked_[name] = true;
  }
  return sh;
}
function rows_(name){
  const sh = tab_(name);
  const vals = sh.getDataRange().getValues();
  const head = vals.shift();
  return vals.filter(r => r.join('') !== '').map(r => {
    const o = {}; head.forEach((h,i) => o[h] = r[i]); return o;
  });
}
function setCell_(name, matchFn, col, value){
  const sh = tab_(name), head = TABS[name], vals = sh.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++){
    const o = {}; head.forEach((h,j) => o[h] = vals[i][j]);
    if (matchFn(o)) { sh.getRange(i+1, head.indexOf(col)+1).setValue(value); return true; }
  }
  return false;
}
// First row matching matchFn: `always` fields are overwritten, `ifBlank` fields only fill empty
// cells (so hand edits in a live sheet survive). No match: append a row from all three.
function upsert_(name, matchFn, always, ifBlank, onInsert){
  const sh = tab_(name), head = TABS[name], vals = sh.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++){
    const o = {}; head.forEach((h,j) => o[h] = vals[i][j]);
    if (matchFn(o)) {
      const row = head.map((h,j) => {
        const cur = vals[i][j] === undefined ? '' : vals[i][j];
        return h in always ? always[h] : (h in ifBlank && blank_(cur)) ? ifBlank[h] : cur;
      });
      sh.getRange(i+1, 1, 1, head.length).setValues([row]);
      return;
    }
  }
  const all = Object.assign({}, onInsert || {}, ifBlank, always);
  sh.appendRow(head.map(h => h in all ? all[h] : ''));
}
// remove rows matching (seasonId,name) then append newRows; whole-tab rewrite (safe under lock, small data)
function replaceRows_(name, sid, playerName, newRows){
  const sh = tab_(name), head = TABS[name];
  const vals = sh.getDataRange().getValues(); const h = vals.shift();
  const nameCol = h.indexOf('name');
  const keep = vals.filter(r => r.join('') !== '' && !(r[0] === sid && r[nameCol] === playerName))
                   .map(r => head.map((_, j) => r[j] === undefined ? '' : r[j]));
  sh.clearContents(); sh.appendRow(head);
  const all = keep.concat(newRows);
  if (all.length) sh.getRange(2, 1, all.length, head.length).setValues(all);
}
function blank_(v){ return v === '' || v === null || v === undefined; }
function ord_(n){ const s = ['th','st','nd','rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
function checkPass_(p){
  const stored = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSPHRASE');
  return !!stored && !!p && String(p) === stored;
}
function newToken_(){ return Utilities.getUuid().replace(/-/g,''); }
function hash_(s){
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s))
    .map(b => (b & 0xff).toString(16).padStart(2,'0')).join('');
}

/* ============================ SETUP ============================ */
// Run from the editor at the start of a season, and again whenever Season.gs
// changes. Safe on a season that's under way: picks, answers, placements,
// resolved questions and the player list are never touched, and names, titles
// and question text only fill in if blank. Profiles and the season's lock /
// Wikipedia settings always update, so fixing a bio is just edit + re-run.

function setup(){
  Object.keys(TABS).forEach(tab_);
  const S = season_(), sid = S.seasonId;

  upsert_('seasons', o => o.seasonId === sid,
    { lockAfterBoots:S.lockAfterBoots || 0, lockNote:S.lockNote || '', wikiTitle:S.wikiTitle || '' },
    { seasonId:sid, show:S.show, title:S.title, castSize:S.cast.length, theme:JSON.stringify(S.theme) },
    { episode:1, locked:'auto' });

  S.cast.forEach(c => upsert_('cast', o => o.seasonId === sid && Number(o.castId) === c.id,
    { age:c.age || '', home:c.home || '', tribe:c.tribe || '', bio:c.bio || '' },
    { seasonId:sid, castId:c.id, name:c.name, occ:c.occ || '' },
    { actual:c.out || '' }));

  S.questions.forEach(q => upsert_('questions', o => o.seasonId === sid && o.qId === q.qId,
    {}, { seasonId:sid, qId:q.qId, text:q.text }, { isTrue:'' }));

  // roster only seeds a season with no players yet, so re-running never re-adds someone you removed
  if (!rows_('players').some(p => p.seasonId === sid))
    (S.roster || []).forEach(n => tab_('players').appendRow([sid, n, n === 'AI', '', '']));

  SpreadsheetApp.flush();
}
