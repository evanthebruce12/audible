/*
 * Audible watcher (Cloudflare Worker)
 * - Sends push notifications for lineup, matchup, and league events
 * - Backs up app settings behind a PIN
 *
 * Setup: bind a KV namespace as `KV`, add a cron trigger "*\/2 * * * *".
 * No secrets needed: push keys are generated on first use and kept in KV.
 */
const SLEEPER = "https://api.sleeper.app/v1";
const ESPN = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
const ESPN_ATH = "https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/";
const VAPID_SUB = "mailto:audible-app@users.noreply.github.com";
const enc = new TextEncoder();
const CORS = {"Access-Control-Allow-Origin":"*", "Access-Control-Allow-Methods":"GET,POST,OPTIONS", "Access-Control-Allow-Headers":"content-type"};
const DEF_PREFS = {lineup:true, night:true, lead:true, close:true, final:true, waivers:true, trades:true, brief:true, badge:false, qs:22, qe:8};
const FIX = {WSH:"WAS", LA:"LAR", JAC:"JAX"};
const BAD = {Out:"OUT", Doubtful:"doubtful", IR:"on IR", Suspended:"suspended", PUP:"on PUP"};
const ELIG = {QB:["QB"],RB:["RB"],WR:["WR"],TE:["TE"],K:["K"],DEF:["DEF"],FLEX:["RB","WR","TE"],WRRB_FLEX:["RB","WR"],REC_FLEX:["WR","TE"],SUPER_FLEX:["QB","RB","WR","TE"],DL:["DL","DE","DT"],LB:["LB"],DB:["DB","CB","S"],IDP_FLEX:["DL","DE","DT","LB","DB","CB","S"]};
const SLBL = {FLEX:"FLEX", SUPER_FLEX:"Superflex", WRRB_FLEX:"W/R flex", REC_FLEX:"W/T flex", IDP_FLEX:"IDP flex"};

export default {
  async fetch(req, env){
    if(req.method === "OPTIONS") return new Response(null, {headers:CORS});
    const url = new URL(req.url), p = url.pathname;
    try{
      if(p === "/" ) return json({ok:true, app:"audible-watcher", v:2});
      if(p === "/vapid") return json({key:(await vapid(env)).pub});
      if(p === "/hasbackup") return json({exists:!!(await env.KV.get("bk:" + norm(url.searchParams.get("u"))))});
      if(req.method !== "POST") return json({error:"not found"}, 404);
      const b = await req.json().catch(() => ({}));
      if(p === "/register") return json(await register(env, b));
      if(p === "/unregister"){ const u = await getUser(env, b.user_id); if(u){ delete u.sub; await env.KV.put("u:" + u.user_id, JSON.stringify(u)); } return json({ok:true}); }
      if(p === "/test"){
        const u = await getUser(env, b.user_id); if(!u || !u.sub) return json({error:"Notifications aren't turned on for this phone yet."}, 400);
        const s = await push(env, u.sub, {title:"Audible", body:"Notifications are on. I'll keep an eye on your lineup and your league.", url:"./#home", tag:"test"});
        if(s === 404 || s === 410){ delete u.sub; await env.KV.put("u:" + u.user_id, JSON.stringify(u)); return json({error:"This phone's notification permission expired. Turn notifications on again."}, 400); }
        return json({ok:s < 300, status:s});
      }
      if(p === "/backup") return backup(env, b);
      if(p === "/restore") return restore(env, b);
      if(p === "/run"){ await runAll(env, new Date(), b.force); return json({ok:true}); }
      return json({error:"not found"}, 404);
    }catch(e){ return json({error:String(e && e.message || e)}, 500); }
  },
  async scheduled(ev, env, ctx){ ctx.waitUntil(runAll(env, new Date(ev.scheduledTime))); }
};

/* ---------------- helpers ---------------- */
const json = (o, s = 200) => new Response(JSON.stringify(o), {status:s, headers:{...CORS, "content-type":"application/json"}});
const norm = s => String(s || "").trim().toLowerCase();
async function get(url){ const r = await fetch(url, {headers:{"user-agent":"audible-watcher"}}); if(!r.ok) throw new Error(url + " " + r.status); return r.json(); }
const b64u = buf => { let s = ""; const a = new Uint8Array(buf); for(let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""); };
const ub64u = s => { s = String(s).replace(/-/g,"+").replace(/_/g,"/"); while(s.length % 4) s += "="; const b = atob(s); const a = new Uint8Array(b.length); for(let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };
const concat = (...xs) => { const n = xs.reduce((t, x) => t + x.length, 0), o = new Uint8Array(n); let i = 0; for(const x of xs){ o.set(x, i); i += x.length; } return o; };
async function sha(s){ return b64u(await crypto.subtle.digest("SHA-256", enc.encode(s))); }
const f1 = n => (Math.round((n || 0) * 10) / 10).toFixed(1);

function local(d, tz){
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {timeZone:tz, weekday:"short", hour:"numeric", minute:"numeric", hour12:false, year:"numeric", month:"2-digit", day:"2-digit"}).formatToParts(d).map(x => [x.type, x.value]));
  return {dow:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(parts.weekday), hour:+parts.hour % 24, minute:+parts.minute, ymd:`${parts.year}-${parts.month}-${parts.day}`};
}
function clock(d, tz){
  const s = new Intl.DateTimeFormat("en-US", {timeZone:tz, hour:"numeric", minute:"2-digit"}).format(d).toLowerCase().replace(/\s/g, "");
  return s.replace(":00", "");
}
const inQuiet = (h, qs, qe) => qs === qe ? false : qs > qe ? (h >= qs || h < qe) : (h >= qs && h < qe);

/* ---------------- users & backups ---------------- */
async function getUser(env, id){ return id ? env.KV.get("u:" + id, "json") : null; }
async function register(env, b){
  if(!b.user_id || !b.league_id) throw new Error("Missing user or league");
  const prev = (await getUser(env, b.user_id)) || {};
  const u = {...prev, user_id:String(b.user_id), username:b.username || prev.username, league_id:String(b.league_id), roster_id:b.roster_id ?? prev.roster_id,
    tz:b.tz || prev.tz || "America/Detroit", prefs:{...DEF_PREFS, ...(prev.prefs || {}), ...(b.prefs || {})}, updated:Date.now()};
  if(b.sub) u.sub = b.sub;
  if(b.players) u.players = b.players;          // {sleeper_id: [name, pos, team, espn_id, value, injury]}
  if(b.teams) u.teams = b.teams;                // {roster_id: team name}
  if(b.slots) u.slots = b.slots;                // lineup slot list
  if(b.rec) u.rec = b.rec;                      // {w,l,t}
  if("apiKey" in b) u.apiKey = b.apiKey || "";
  if(b.model) u.model = b.model;
  await env.KV.put("u:" + u.user_id, JSON.stringify(u));
  const ids = (await env.KV.get("users", "json")) || [];
  if(!ids.includes(u.user_id)){ ids.push(u.user_id); await env.KV.put("users", JSON.stringify(ids)); }
  return {ok:true, notifications:!!u.sub};
}
async function backup(env, b){
  const u = norm(b.username), pin = String(b.pin || "");
  if(!u || !/^\d{4}$/.test(pin) || !b.data) return json({error:"Need a username, a 4-digit PIN, and data."}, 400);
  const cur = await env.KV.get("bk:" + u, "json");
  if(cur && cur.hash !== await sha(pin + ":" + u + ":" + cur.salt)) return json({error:"That PIN doesn't match this backup."}, 403);
  const salt = cur ? cur.salt : b64u(crypto.getRandomValues(new Uint8Array(12)));
  await env.KV.put("bk:" + u, JSON.stringify({hash:await sha(pin + ":" + u + ":" + salt), salt, data:b.data, t:Date.now()}));
  return json({ok:true, t:Date.now()});
}
async function restore(env, b){
  const u = norm(b.username), pin = String(b.pin || "");
  const cur = await env.KV.get("bk:" + u, "json");
  if(!cur) return json({error:"No backup found for that username."}, 404);
  const fk = "f:" + u, f = (await env.KV.get(fk, "json")) || {n:0, t:0};
  if(f.n >= 5 && Date.now() - f.t < 3600e3) return json({error:"Too many wrong PINs. Try again in an hour."}, 429);
  if(cur.hash !== await sha(pin + ":" + u + ":" + cur.salt)){
    await env.KV.put(fk, JSON.stringify({n:(Date.now() - f.t < 3600e3 ? f.n : 0) + 1, t:Date.now()}), {expirationTtl:3600});
    return json({error:"Wrong PIN."}, 403);
  }
  if(f.n) await env.KV.delete(fk);
  return json({ok:true, data:cur.data, t:cur.t});
}

/* ---------------- web push (VAPID + aes128gcm, RFC 8291/8292) ---------------- */
async function vapid(env){
  let k = await env.KV.get("vapid", "json");
  if(!k){
    const kp = await crypto.subtle.generateKey({name:"ECDSA", namedCurve:"P-256"}, true, ["sign", "verify"]);
    k = {priv:await crypto.subtle.exportKey("jwk", kp.privateKey), pub:b64u(await crypto.subtle.exportKey("raw", kp.publicKey))};
    await env.KV.put("vapid", JSON.stringify(k));
  }
  return k;
}
async function vapidAuth(env, endpoint){
  const k = await vapid(env);
  const h = b64u(enc.encode(JSON.stringify({typ:"JWT", alg:"ES256"})));
  const c = b64u(enc.encode(JSON.stringify({aud:new URL(endpoint).origin, exp:Math.floor(Date.now() / 1000) + 12 * 3600, sub:VAPID_SUB})));
  const key = await crypto.subtle.importKey("jwk", k.priv, {name:"ECDSA", namedCurve:"P-256"}, false, ["sign"]);
  const sig = await crypto.subtle.sign({name:"ECDSA", hash:"SHA-256"}, key, enc.encode(h + "." + c));
  return `vapid t=${h}.${c}.${b64u(sig)}, k=${k.pub}`;
}
async function hkdf(salt, ikm, info, len){
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({name:"HKDF", hash:"SHA-256", salt, info}, key, len * 8));
}
export async function encryptPayload(sub, text){
  const uaPub = ub64u(sub.keys.p256dh), auth = ub64u(sub.keys.auth);
  const as = await crypto.subtle.generateKey({name:"ECDH", namedCurve:"P-256"}, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", as.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPub, {name:"ECDH", namedCurve:"P-256"}, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({name:"ECDH", public:uaKey}, as.privateKey, 256));
  const ikm = await hkdf(auth, shared, concat(enc.encode("WebPush: info\0"), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const k = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM", iv:nonce}, k, concat(enc.encode(text), new Uint8Array([2]))));
  const hdr = new Uint8Array(86); hdr.set(salt, 0); new DataView(hdr.buffer).setUint32(16, 4096); hdr[20] = 65; hdr.set(asPub, 21);
  return concat(hdr, ct);
}
async function push(env, sub, data){
  const body = await encryptPayload(sub, JSON.stringify(data));
  const r = await fetch(sub.endpoint, {method:"POST", body, headers:{"TTL":"43200", "Urgency":"high", "Content-Encoding":"aes128gcm", "Content-Type":"application/octet-stream", "Authorization":await vapidAuth(env, sub.endpoint)}});
  return r.status;
}

/* ---------------- the watcher ---------------- */
async function loadGames(state, week){
  try{
    const st = state.season_type === "post" ? 3 : 2;
    const d = await get(`${ESPN}/scoreboard?seasontype=${st}&week=${week}&dates=${state.season}`);
    return (d.events || []).map(ev => {
      const c = ev.competitions[0], s = c.status || ev.status || {}, t = s.type || {};
      const side = h => { const x = c.competitors.find(k => k.homeAway === h) || {}; const tm = x.team || {}; return {abbr:FIX[tm.abbreviation] || tm.abbreviation, score:+x.score || 0}; };
      return {date:new Date(ev.date), state:t.state || "pre", period:s.period || 0, clock:s.displayClock || "", home:side("home"), away:side("away")};
    });
  }catch(e){ return []; }
}
export async function runAll(env, now, force){
  const ids = (await env.KV.get("users", "json")) || [];
  if(!ids.length) return;
  const state = await get(`${SLEEPER}/state/nfl`);
  const week = Math.max(1, state.week || 1);
  const games = await loadGames(state, week);
  const live = games.some(g => g.state === "in");
  // v2: when nothing can be due (no live games, not a 15-minute check, and no game ended recently), skip everyone without reading their records
  const tick = !!force || now.getUTCMinutes() % 15 < 2;
  const meta = (await env.KV.get("meta", "json")) || {};
  const recent = meta.live && now - meta.live < 25 * 60000;
  if(live && (!meta.live || now - meta.live > 10 * 60000)) await env.KV.put("meta", JSON.stringify({live:+now}));
  if(!live && !tick && !recent) return;
  // v2: league data and injuries are fetched once per run and shared by everyone who needs them
  const C = {now, state, week, games, live, force:!!force, inj:{}, ms:{}, tx:{}, injAll:null};
  C.matchups = lid => C.ms[lid] || (C.ms[lid] = get(`${SLEEPER}/league/${lid}/matchups/${week}`).catch(() => []));
  C.transactions = lid => C.tx[lid] || (C.tx[lid] = get(`${SLEEPER}/league/${lid}/transactions/${week}`).catch(() => []));
  for(const id of ids){
    try{ await runUser(env, id, C); }catch(e){ console.log("audible user", id, e && e.stack || e); }
  }
}
// One call for the whole league-wide injury report. Returns a map of ESPN athlete id to status, or null if it can't be trusted.
async function allInjuries(C){
  if(C.injAll) return C.injAll;
  return (C.injAll = (async () => {
    try{
      const d = await get(`${ESPN}/injuries`), m = {};
      for(const t of (d.injuries || [])) for(const i of (t.injuries || [])){
        const a = i.athlete || {}; let id = a.id;
        if(!id){ const h = ((a.links || [])[0] || {}).href || a.$ref || ""; const k = /\/id\/(\d+)|athletes\/(\d+)/.exec(h); id = k && (k[1] || k[2]); }
        if(id) m[String(id)] = i.status || (i.type && (i.type.description || i.type.name)) || "";
      }
      return Object.keys(m).length >= 20 ? m : null;
    }catch(e){ return null; }
  })());
}
const injWord = (raw, st) => /out/i.test(raw) ? "Out" : /doubt/i.test(raw) ? "Doubtful" : /question/i.test(raw) ? "Questionable" : /reserve|IR/i.test(raw) ? "IR" : /suspen/i.test(raw) ? "Suspended" : st;
async function injury(C, u, id){
  if(id in C.inj) return C.inj[id];
  const p = (u.players || {})[id] || [];
  let st = p[5] || "";
  const all = p[3] ? await allInjuries(C) : null;
  if(all){ const raw = all[String(p[3])]; return (C.inj[id] = raw ? injWord(raw, st) : ""); }
  if(p[3]){
    try{
      const j = await get(ESPN_ATH + p[3]);
      const a = j.athlete || {}, i = (a.injuries || [])[0];
      const raw = (i && (i.status || (i.type && (i.type.description || i.type.name)))) || "";
      if(raw) st = /out/i.test(raw) ? "Out" : /doubt/i.test(raw) ? "Doubtful" : /question/i.test(raw) ? "Questionable" : /reserve|IR/i.test(raw) ? "IR" : /suspen/i.test(raw) ? "Suspended" : st;
      else if(i === undefined && a.injuries) st = "";
    }catch(e){}
  }
  return (C.inj[id] = st);
}
async function runUser(env, id, C){
  const u = await getUser(env, id); if(!u || !u.sub) return;
  const P = {...DEF_PREFS, ...(u.prefs || {})}, tz = u.tz || "America/Detroit", lt = local(C.now, tz);
  const quiet = inQuiet(lt.hour, P.qs, P.qe);
  const st = (await env.KV.get("s:" + id, "json")) || {};
  let dirty = false;
  if(st.week !== C.week){ st.week = C.week; st.sent = {}; st.lead = null; dirty = true; }
  st.sent = st.sent || {};
  const tick = C.force || C.now.getUTCMinutes() % 15 < 2;
  const isNight = lt.dow === 6 && lt.hour === 20 && lt.minute < 2;
  const isBrief = lt.dow === 2 && lt.hour === 9 && lt.minute < 2;
  const pendingFinal = st.lead != null && !st.sent.final;
  if(!C.live && !tick && !isNight && !isBrief && !pendingFinal) { if(dirty) await env.KV.put("s:" + id, JSON.stringify(st)); return; }

  const out = [];
  const say = (key, body, url, extra) => { if(st.sent[key]) return; st.sent[key] = Date.now(); dirty = true; out.push({title:"Audible", body, url:url || "./#home", tag:key.split(":")[0], ...(extra || {})}); };
  const name = pid => ((u.players || {})[pid] || [])[0] || "A player";
  const pos = pid => ((u.players || {})[pid] || [])[1] || "";
  const team = pid => ((u.players || {})[pid] || [])[2] || "";
  const gameOf = t => C.games.find(g => g.home.abbr === t || g.away.abbr === t);
  const gstate = pid => { const t = team(pid); if(!t) return "post"; const g = gameOf(t); return g ? g.state : (C.games.length > 10 ? "bye" : "pre"); };
  const tname = rid => (u.teams || {})[rid] || "Your opponent";

  const ms = await C.matchups(u.league_id);
  const me = ms.find(m => m.roster_id === u.roster_id);
  const op = me && me.matchup_id != null ? ms.find(m => m.matchup_id === me.matchup_id && m.roster_id !== me.roster_id) : null;
  const slots = u.slots || [];
  let badIssues = 0;

  /* ---- lineup ---- */
  if(me && (P.lineup || P.night) && (tick || isNight)){
    const starters = me.starters || [];
    const startSet = new Set(starters);
    const bench = (me.players || []).filter(x => !startSet.has(x));
    const issues = [];
    for(let i = 0; i < starters.length; i++){
      const pid = starters[i], slot = slots[i] || "";
      if(!pid || pid === "0"){ issues.push({pid:null, slot, level:"bad", what:"empty"}); continue; }
      const gs = gstate(pid);
      if(gs === "bye"){ issues.push({pid, slot, level:"bad", what:"bye"}); continue; }
      if(gs !== "pre") continue;
      const g = gameOf(team(pid)); if(!g) continue;
      const mins = (g.date - C.now) / 60000;
      if(!isNight && !(local(g.date, tz).ymd === lt.ymd || mins < 36 * 60)) continue;
      if(pos(pid) === "DEF") continue;
      const s = await injury(C, u, pid);
      if(BAD[s]) issues.push({pid, slot, level:"bad", what:s, g, mins});
      else if(s === "Questionable") issues.push({pid, slot, level:"warn", what:s, g, mins});
    }
    badIssues = issues.filter(x => x.level === "bad").length;
    const subFor = async (slot, taken) => {
      const ok = ELIG[slot] || [slot];
      const cands = bench.filter(b => !taken.has(b) && ok.includes(pos(b)) && gstate(b) === "pre")
        .sort((a, b) => (((u.players || {})[b] || [])[4] || 0) - (((u.players || {})[a] || [])[4] || 0));
      for(const c of cands.slice(0, 3)){ const s = await injury(C, u, c); if(!BAD[s] && s !== "Questionable") return c; }
      return null;
    };
    const taken = new Set();
    for(const x of issues){ const s = await subFor(x.slot, taken); x.sub = s; if(s) taken.add(s); }
    const line = x => {
      const who = x.pid ? name(x.pid) : null, sl = SLBL[x.slot] || x.slot;
      const fix = x.sub ? ` Swap in ${name(x.sub)} at ${sl}` : ` Nobody on your bench fits ${sl}, so grab someone off waivers`;
      if(!x.pid) return `Your ${sl} slot is empty.${x.sub ? ` Start ${name(x.sub)}.` : fix + "."}`;
      if(x.what === "bye") return `${who} is on bye this week.${fix}.`;
      if(x.level === "warn") return `${who} is questionable for ${clock(x.g.date, tz)}.${x.sub ? ` ${name(x.sub)} is your backup if he sits.` : ""}`;
      return `${who} is ${BAD[x.what]}.${fix}${x.g ? ` before ${clock(x.g.date, tz)}` : ""}.`;
    };
    if(isNight && P.night && !quiet){
      if(issues.length) say("night", issues.length === 1 ? line(issues[0]) : `${issues.length} things before tomorrow: ` + issues.map(line).join(" "), "./#team");
    }
    if(P.lineup){
      for(const x of issues.filter(x => x.level === "bad")){
        const soon = x.mins != null && x.mins <= 100;
        const today = x.g ? local(x.g.date, tz).ymd === lt.ymd : lt.dow === 0;
        if(!quiet && (soon || (today && lt.hour >= 8))) say(`lineup:${x.pid || "empty" + x.slot}:${x.what}`, line(x), "./#team");
      }
      for(const x of issues.filter(x => x.level === "warn" && x.mins != null && x.mins <= 100 && x.mins > 0)){
        if(!quiet) say(`q:${x.pid}`, line(x), "./#team");
      }
    }
  }

  /* ---- matchup ---- */
  if(me && op){
    const a = me.points || 0, b = op.points || 0, diff = a - b, opp = tname(op.roster_id);
    const all = [...(me.starters || []), ...(op.starters || [])].filter(x => x && x !== "0");
    const states = all.map(gstate);
    const anyLive = states.includes("in"), allDone = all.length > 0 && states.every(s => s === "post" || s === "bye");
    if(P.lead && anyLive && Math.abs(diff) > .05){
      const s = diff > 0 ? 1 : -1;
      if(st.lead != null && st.lead !== s && Date.now() - (st.leadT || 0) > 20 * 60000){
        delete st.sent.lead;
        say("lead", s > 0 ? `You just took the lead, ${f1(a)} to ${f1(b)}.` : `${opp} just took the lead, ${f1(b)} to ${f1(a)}.`, "./#matchup");
        st.leadT = Date.now();
      }
      if(st.lead !== s){ st.lead = s; dirty = true; }
    }
    const rel = C.games.filter(g => g.state !== "post" && all.some(x => team(x) === g.home.abbr || team(x) === g.away.abbr));
    if(P.close && anyLive && Math.abs(diff) <= 10 && rel.length && rel.every(g => g.state === "in" && g.period >= 4)){
      const myLeft = (me.starters || []).filter(x => x && x !== "0" && gstate(x) === "in").length;
      say("close", `${diff >= 0 ? "You're up" : "You're down"} ${f1(Math.abs(diff))} with ${rel[0].clock} left in the 4th.${myLeft ? ` ${myLeft} of your starters ${myLeft === 1 ? "is" : "are"} still playing.` : " Your guys are done, so it's on their side now."}`, "./#matchup");
    }
    if(P.final && allDone){
      const won = diff > 0, tie = Math.abs(diff) < .01, r = u.rec || {w:0, l:0, t:0};
      const w = r.w + (won && !tie ? 1 : 0), l = r.l + (!won && !tie ? 1 : 0), t = (r.t || 0) + (tie ? 1 : 0);
      say("final", `Final: you ${tie ? "tied" : won ? "won" : "lost"} ${f1(a)} to ${f1(b)}. You're ${w}-${l}${t ? "-" + t : ""}.`, "./#matchup");
    }
  }

  /* ---- league activity (waits for 8am during quiet hours) ---- */
  if((P.waivers || P.trades) && tick && !quiet){
    const txs = (await C.transactions(u.league_id)).filter(t => t && t.status === "complete");
    const seen = new Set(st.tx || []);
    const fresh = txs.filter(t => !seen.has(t.transaction_id));
    if(!st.txInit){ st.txInit = true; }
    else {
      if(P.trades) for(const t of fresh.filter(t => t.type === "trade")){
        const sides = (t.roster_ids || []).map(r => { const got = Object.keys(t.adds || {}).filter(p => t.adds[p] === r).map(name); return {r, got}; });
        const desc = sides.length === 2 ? `${tname(sides[0].r)} sent ${sides[1].got.join(", ") || "picks"} to ${tname(sides[1].r)} for ${sides[0].got.join(", ") || "picks"}.` : "A trade just went through.";
        say("trade:" + t.transaction_id, (t.roster_ids || []).includes(u.roster_id) ? `Your trade went through. ${desc}` : `Trade in your league: ${desc}`, "./#league-activity");
      }
      const wv = fresh.filter(t => t.type === "waiver");
      if(P.waivers && wv.length){
        const mine = wv.filter(t => (t.roster_ids || []).includes(u.roster_id));
        const got = mine.map(t => Object.keys(t.adds || {}).map(p => `${name(p)}${t.settings && t.settings.waiver_bid != null ? ` for $${t.settings.waiver_bid}` : ""}`).join(", ")).filter(Boolean);
        const others = wv.length - mine.length;
        const body = got.length ? `Waivers are in. You got ${got.join(" and ")}.${others ? ` ${others} other claim${others === 1 ? "" : "s"} went through.` : ""}` : `Waivers are in. ${wv.length} claim${wv.length === 1 ? "" : "s"} went through, none for you this time.`;
        say("waivers:" + wv.map(t => t.transaction_id).join(","), body, "./#league-activity");
      }
    }
    if(fresh.length || !st.tx){ st.tx = [...seen, ...fresh.map(t => t.transaction_id)].slice(-300); dirty = true; }
  }

  /* ---- Tuesday briefing ---- */
  if(P.brief && isBrief && !quiet && !st.sent.brief){
    let body = `Your Week ${C.week} briefing is ready. Tap for my full take on your lineup, waivers, and trades.`;
    if(u.apiKey && me){
      try{
        const roster = (me.players || []).map(p => `${name(p)} (${pos(p)} ${team(p)})`).join(", ");
        const r = await fetch("https://api.anthropic.com/v1/messages", {method:"POST", headers:{"content-type":"application/json", "x-api-key":u.apiKey, "anthropic-version":"2023-06-01"},
          body:JSON.stringify({model:"claude-haiku-5-5", max_tokens:1024, messages:[{role:"user", content:`You are Audible, a fantasy football assistant. Write ONE push notification under 150 characters teasing this week's top priority for this team. Plain text, no emojis, no quotes. Week ${C.week}. Roster: ${roster}.`}]})});
        if(r.ok){ const d = await r.json(); const t = (d.content || []).filter(x => x.type === "text").map(x => x.text).join(" ").trim(); if(t) body = t.trim().replace(/^"|"$/g, "").slice(0, 170) + " Tap for the full briefing."; }
      }catch(e){}
    }
    say("brief", body, "./#chat-brief");
  }

  for(const n of out){
    if(P.badge) n.badge = badIssues;
    const s = await push(env, u.sub, n);
    if(s === 404 || s === 410){ delete u.sub; await env.KV.put("u:" + id, JSON.stringify(u)); break; }
  }
  if(dirty) await env.KV.put("s:" + id, JSON.stringify(st));
}
