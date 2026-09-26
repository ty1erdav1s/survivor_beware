/* In-browser stand-ins for the Google Apps Script services Code.gs uses, so the
   real backend runs locally against a fake spreadsheet kept in localStorage.
   Dev only — loaded by dev/local.html, never deployed. */
(function(){
  const KEY = "dev_sheet_" + SEASON.seasonId;   // one fake sheet per season, so both pools can share 127.0.0.1
  let book; try { book = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (_) { book = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(book)); } catch (_) {} };

  function Range(name, r, c, nr, nc){ Object.assign(this, { name, r, c, nr, nc }); }
  Range.prototype = {
    getValues(){
      const d = book[this.name], out = [];
      for (let i = 0; i < this.nr; i++){
        const row = [];
        for (let j = 0; j < this.nc; j++){ const v = (d[this.r-1+i] || [])[this.c-1+j]; row.push(v == null ? '' : v); }
        out.push(row);
      }
      return out;
    },
    setValues(vals){
      const d = book[this.name];
      vals.forEach((row, i) => {
        const R = this.r - 1 + i;
        while (d.length <= R) d.push([]);
        row.forEach((v, j) => { const C = this.c - 1 + j; while (d[R].length < C) d[R].push(''); d[R][C] = v; });
      });
      save();
    },
    setValue(v){ this.setValues([[v]]); }
  };
  function Sheet(name){ this.name = name; }
  Sheet.prototype = {
    appendRow(row){ book[this.name].push(row.slice()); save(); },
    getLastRow(){ return book[this.name].length; },
    getLastColumn(){ return Math.max(0, ...book[this.name].map(r => r.length)); },
    getDataRange(){ return new Range(this.name, 1, 1, Math.max(book[this.name].length, 1), Math.max(this.getLastColumn(), 1)); },
    getRange(r, c, nr, nc){ return new Range(this.name, r, c, nr || 1, nc || 1); },
    clearContents(){ book[this.name] = []; save(); }
  };

  window.SpreadsheetApp = {
    getActiveSpreadsheet(){ return {
      getSheetByName(n){ return book[n] ? new Sheet(n) : null; },
      insertSheet(n){ book[n] = []; save(); return new Sheet(n); }
    }; },
    flush(){}
  };
  window.PropertiesService = { getScriptProperties(){ return { getProperty(k){ return k === 'ADMIN_PASSPHRASE' ? 'dev' : null; } }; } };
  window.LockService = { getScriptLock(){ return { tryLock(){ return true; }, releaseLock(){} }; } };
  window.ScriptApp = { getProjectTriggers(){ return []; }, deleteTrigger(){}, newTrigger(){ throw new Error('triggers are not available in the sandbox'); } };
  window.ContentService = {
    MimeType: { JSON:'json' },
    createTextOutput(s){ return { setMimeType(){ return this; }, getContent(){ return s; } }; }
  };
  // Not SHA-256 — just a stable 32-byte digest, which is all the token check needs locally.
  window.Utilities = {
    DigestAlgorithm: { SHA_256:'SHA-256' },
    getUuid(){ return crypto.randomUUID(); },
    computeDigest(_, s){
      const out = [];
      for (let k = 0; k < 32; k++){
        let h = 2166136261 ^ k;
        for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
        out.push(((h >>> 0) & 0xff) - 128);
      }
      return out;
    }
  };
  // Real Wikipedia by default; set window.DEV_WIKI_TEXT to a wikitext string to test against a fixture.
  window.UrlFetchApp = {
    fetch(url){
      if (window.DEV_WIKI_TEXT != null) {
        const body = JSON.stringify({ parse:{ wikitext:window.DEV_WIKI_TEXT } });
        return { getResponseCode(){ return 200; }, getContentText(){ return body; } };
      }
      const x = new XMLHttpRequest(); x.open('GET', url, false); x.send();
      return { getResponseCode(){ return x.status; }, getContentText(){ return x.responseText; } };
    }
  };

  // Route the site's API_URL ("dev://gas") to doGet/doPost from Code.gs.
  const realFetch = window.fetch.bind(window);
  window.fetch = async (url, opts) => {
    if (!String(url).startsWith('dev://gas')) return realFetch(url, opts);
    await new Promise(r => setTimeout(r, 150));   // a little latency, like the real thing
    const q = new URL(String(url).replace('dev://gas', 'http://x/')).searchParams;
    const out = opts && opts.method === 'POST'
      ? doPost({ postData:{ contents:opts.body } })
      : doGet({ parameter:Object.fromEntries(q) });
    const txt = out.getContent();
    return { ok:true, json:async () => JSON.parse(txt) };
  };
})();
