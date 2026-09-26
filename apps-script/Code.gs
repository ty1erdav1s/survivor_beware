/**********************************************************************
 * SURVIVORS BEWARE — backend
 * ------------------------------------------------------------------
 * One Google Sheet is the data store. This script exposes it as a
 * tiny JSON API that the GitHub Pages site reads from and writes to.
 * Nobody edits the sheet by hand.
 *
 * ONE-TIME SETUP
 *   1. Extensions > Apps Script, paste this file, Save.
 *   2. Run setup()  (authorize when prompted). This builds the tabs
 *      and seeds Season 51 so the site works immediately.
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
const CURRENT = 's51';                        // active season id

const TABS = {
  seasons:   ['seasonId','show','title','episode','castSize','locked','theme'],
  cast:      ['seasonId','castId','name','occ','actual'],
  players:   ['seasonId','name','isAI','tokenHash','submittedAt'],
  questions: ['seasonId','qId','text','isTrue'],
  answers:   ['seasonId','name','qId','answer'],
  picks:     ['seasonId','name','castId','rank']
};

/* ============================ ROUTING ============================ */

function doGet(e){
  const action = (e && e.parameter && e.parameter.action) || 'getSeason';
  if (action === 'getSeason') return json_({ ok:true, data:getSeason_(CURRENT) });
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
      addPlayer, removePlayer, enterEviction, undoEviction,
      resolveQuestion, setEpisode, setLocked
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
                 actual:c.actual === '' ? null : Number(c.actual) }))
    .sort((a,b) => a.id - b.id);

  const questions = rows_('questions').filter(q => q.seasonId === sid)
    .map(q => ({ qId:q.qId, text:q.text, isTrue:q.isTrue === '' ? null : String(q.isTrue) }));

  const answers = rows_('answers').filter(a => a.seasonId === sid);
  const picks   = rows_('picks').filter(p => p.seasonId === sid);

  const players = rows_('players').filter(p => p.seasonId === sid).map(p => {
    const ranks = {};
    picks.filter(x => x.name === p.name).forEach(x => ranks[Number(x.castId)] = Number(x.rank));
    let bonus = 0;
    answers.filter(x => x.name === p.name).forEach(x => {
      const q = questions.find(q => q.qId === x.qId);
      if (q && q.isTrue !== null && String(x.answer) === q.isTrue) bonus -= 1;
    });
    return {
      name:p.name,
      isAI: p.isAI === true || String(p.isAI).toUpperCase() === 'TRUE',
      bonus,
      ranks,
      submitted: Object.keys(ranks).length > 0
    };
  });

  let theme = null;
  try { theme = s.theme ? JSON.parse(s.theme) : null; } catch (_) {}

  return {
    season: {
      seasonId: sid, show: s.show, title: s.title,
      episode: Number(s.episode) || 1,
      castSize: Number(s.castSize) || cast.length,
      locked: s.locked === true || String(s.locked).toUpperCase() === 'TRUE',
      theme
    },
    cast, players, questions
  };
}

/* ========================= PLAYER WRITE ========================= */

function submitEntry_(b){
  const sid = CURRENT;
  const season = getSeason_(sid).season;
  if (season.locked) return { ok:false, error:'Picks are locked for this season' };

  const me = rows_('players').filter(p => p.seasonId === sid).find(p => p.name === b.name);
  if (!me) return { ok:false, error:'That name is not on the roster yet — ask the admin to add you' };

  // edit-token gate
  let issued = null;
  if (me.tokenHash) {
    if (hash_(b.token || '') !== me.tokenHash)
      return { ok:false, error:'This name was already submitted from another device' };
  } else {
    issued = newToken_();
  }

  // validate ranking is a full 1..N permutation of the current cast
  const cast = rows_('cast').filter(c => c.seasonId === sid);
  const N = cast.length;
  const ranks = b.ranks || {};
  const vals = cast.map(c => Number(ranks[c.castId]));
  if (vals.some(v => !(v >= 1 && v <= N)) || new Set(vals).size !== N)
    return { ok:false, error:'Rank every castaway exactly once, 1 to ' + N };

  replaceRows_('picks', sid, b.name, cast.map(c => [sid, b.name, Number(c.castId), Number(ranks[c.castId])]));

  const ans = b.answers || {};
  replaceRows_('answers', sid, b.name, Object.keys(ans).map(q => [sid, b.name, q, String(ans[q])]));

  setCell_('players', o => o.seasonId === sid && o.name === b.name, 'submittedAt', new Date().toISOString());
  if (issued) setCell_('players', o => o.seasonId === sid && o.name === b.name, 'tokenHash', hash_(issued));

  return { ok:true, token:issued };   // raw token returned only the first time
}

/* ========================= ADMIN WRITES ======================== */

function addPlayer(b){
  const sid = CURRENT, name = String(b.name || '').trim();
  if (!name) return { ok:false, error:'Name required' };
  if (rows_('players').some(p => p.seasonId === sid && p.name === name))
    return { ok:false, error:'That player already exists' };
  tab_('players').appendRow([sid, name, !!b.isAI, '', '']);
  return { ok:true };
}

function removePlayer(b){
  const sid = CURRENT, name = String(b.name || '');
  ['players','picks','answers'].forEach(t => replaceRows_(t, sid, name, []));
  return { ok:true };
}

function enterEviction(b){
  const ok = setCell_('cast', o => o.seasonId === CURRENT && Number(o.castId) === Number(b.castId),
                      'actual', Number(b.placement));
  return ok ? { ok:true } : { ok:false, error:'Castaway not found' };
}

function undoEviction(b){
  setCell_('cast', o => o.seasonId === CURRENT && Number(o.castId) === Number(b.castId), 'actual', '');
  return { ok:true };
}

function resolveQuestion(b){
  setCell_('questions', o => o.seasonId === CURRENT && o.qId === b.qId, 'isTrue', String(b.isTrue));
  return { ok:true };
}

function setEpisode(b){
  setCell_('seasons', o => o.seasonId === CURRENT, 'episode', Number(b.episode));
  return { ok:true };
}

function setLocked(b){
  setCell_('seasons', o => o.seasonId === CURRENT, 'locked', !!b.locked);
  return { ok:true };
}

/* =========================== HELPERS =========================== */

function json_(o){
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}
function tab_(name){
  let sh = SS.getSheetByName(name);
  if (!sh) { sh = SS.insertSheet(name); sh.appendRow(TABS[name]); }
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
// remove rows matching (seasonId,name) then append newRows; whole-tab rewrite (safe under lock, small data)
function replaceRows_(name, sid, playerName, newRows){
  const sh = tab_(name), head = TABS[name];
  const vals = sh.getDataRange().getValues(); const h = vals.shift();
  const nameCol = h.indexOf('name');
  const keep = vals.filter(r => r.join('') !== '' && !(r[0] === sid && r[nameCol] === playerName));
  sh.clearContents(); sh.appendRow(head);
  const all = keep.concat(newRows);
  if (all.length) sh.getRange(2, 1, all.length, head.length).setValues(all);
}
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
// Run once from the editor. Builds tabs and seeds Season 51.

function setup(){
  Object.keys(TABS).forEach(t => { const sh = tab_(t); if (sh.getLastRow() === 0) sh.appendRow(TABS[t]); });

  const theme = JSON.stringify({
    name:'Torchlight', bg:'#0a130e', surface:'#13221a', line:'#2b4133',
    text:'#f4ead5', muted:'#9fb09a', accent:'#ff8a2b', gold:'#f2c14e',
    danger:'#e5484d', evicted:'#3a3a2c', good:'#6fd08c'
  });

  seedTab_('seasons', [['s51','survivor','Survivors Beware — Season 51', 2, 21, false, theme]]);

  // Survivor 51 cast (CBS). 4th value = finish placement once voted out (21 = first out).
  const CAST = [
    [1,'Aaliyah Puglia','Chef',21],[2,'Alexis Levine','Criminal Defense Attorney',''],
    [3,'Ana Sani','Voice Actress',''],[4,'Brady Booker','Pro Wrestler',''],
    [5,'Carter Krull','Livestock Farmer',''],[6,'Cristian Chavez','Head of HR',''],
    [7,'Danny Kilby','Game Designer',''],[8,'Devin Way','Actor',''],
    [9,'Eric Macksoud','Mental Health Counselor',''],[10,'Jelly Loblack','Sociology Professor',''],
    [11,'Jenna Doore','Wedding Photographer',''],[12,'Kristin Flickinger','Crisis Management',''],
    [13,'Lewis Kelly','Farmer',''],[14,'Linnea Capobianco','Entrepreneur',''],
    [15,'Maggie Nestor','Farmer',''],[16,'Mike Pinsky','Baseball Executive',''],
    [17,'Ori Jean-Charles','Personal Trainer',''],[18,'Patt Cannaday','Federal Prosecutor',''],
    [19,'Rob Antonson','Airline Gate Agent',''],[20,'Sharonda Cox','OBGYN Resident',''],
    [21,'Thien An Nguyen','Medical Student','']
  ];
  seedTab_('cast', CAST.map(c => ['s51', c[0], c[1], c[2], c[3]]));

  // Same group as the BB pool, on the roster but with no picks yet — each submits their own.
  const ROSTER = ['Tyler','Lauren','Lisa','Jeremy','Natalie/Josh','Brandie','Morgan',
                  'Thomas','Carol','Pat','Jamie','Kelly','AI'];
  seedTab_('players', ROSTER.map(name => ['s51', name, name === 'AI', '', '']));
  seedTab_('picks',   []);
  seedTab_('answers', []);

  const Q = [
    ['q1','Will a hidden immunity idol be found before the merge?',''],
    ['q2','Will an idol be played and actually cancel votes?',''],
    ['q3','Will someone be medically evacuated?',''],
    ['q4','Will anyone quit the game?',''],
    ['q5','Will a tie go all the way to a rock draw?',''],
    ['q6','Will someone be blindsided with an idol in their pocket?',''],
    ['q7','Will the winner have won fire-making at Final 4?',''],
    ['q8','Will the winner get a unanimous jury vote?',''],
    ['q9','Will someone cry at Tribal Council?','']
  ];
  seedTab_('questions', Q.map(q => ['s51', q[0], q[1], q[2]]));

  SpreadsheetApp.getUi && SpreadsheetApp.flush();
}

// overwrite a tab's data (keep header) with the given rows
function seedTab_(name, rows){
  const sh = tab_(name), head = TABS[name];
  sh.clearContents(); sh.appendRow(head);
  if (rows.length) sh.getRange(2, 1, rows.length, head.length).setValues(rows);
}
