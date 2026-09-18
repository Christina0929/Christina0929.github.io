/* 晴天小站 Node.js 服务器 - 安全+稳定+性能版
 * 日志: D:\Default Project\对话日志\2026-08-28.txt
 * 回滚: git checkout HEAD~1 server.js */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');
const zlib = require('zlib');

const PORT = process.env.PORT || 8765;
const GITHUB_CLIENT_ID = 'Ov23limaL8KEDjRchSqE';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '568d9b6f35c5c4f058c90c71cf523039b649e64a';
const BASE_URL = 'http://localhost:' + PORT;
const SITE = path.join(__dirname);
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
const PENDING_TTL = 10 * 60 * 1000;
const MAX_MESSAGES = 200;
const MAX_SESSIONS = 500;
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const LINKS_FILE = path.join(DATA_DIR, 'links.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

function readJSON(f, fb) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch(e) { return fb; } }
function writeJSON(f, d) { try { fs.writeFileSync(f, JSON.stringify(d, null, 2), 'utf8'); } catch(e) { console.error('writeJSON:', e); } }

const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.gif':'image/gif', '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.ogg':'audio/ogg', '.opus':'audio/opus', '.webp':'image/webp', '.woff2':'font/woff2', '.woff':'font/woff', '.ttf':'font/ttf', '.ico':'image/x-icon' };
const COMPRESSIBLE = new Set(['text/html','text/css','text/javascript','application/javascript','application/json','image/svg+xml','text/plain','text/xml']);

// Rate limiter
const rateBuckets = new Map();
const RATE_WINDOW = 60000;
function checkRate(key, max) {
  const now = Date.now();
  let b = rateBuckets.get(key);
  if (!b || now > b.reset) { b = { count: 0, reset: now + RATE_WINDOW }; rateBuckets.set(key, b); }
  b.count++;
  return b.count <= max;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of rateBuckets) { if (now > v.reset) rateBuckets.delete(k); } }, 60000);

function cleanSessions(s) {
  const now = Date.now(); let changed = false;
  for (const [k, v] of Object.entries(s)) {
    if (k.startsWith('pending_')) { if (now - v > PENDING_TTL) { delete s[k]; changed = true; } }
    else if (v && v.created && now - v.created > SESSION_TTL) { delete s[k]; changed = true; }
  }
  const entries = Object.entries(s).filter(([k]) => !k.startsWith('pending_'));
  if (entries.length > MAX_SESSIONS) {
    entries.sort((a, b) => (b[1].created||0) - (a[1].created||0));
    for (let i = MAX_SESSIONS; i < entries.length; i++) { delete s[entries[i][0]]; changed = true; }
  }
  return changed;
}

function genToken() { return crypto.randomBytes(32).toString('hex'); }
function stripHTML(s) { return String(s).replace(/<[^>]*>/g, '').replace(/[<>"'&]/g, c => ({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'}[c])); }
function parseCookies(req) { const c = {}; (req.headers.cookie||'').split(';').forEach(x => { const [k,v] = x.trim().split('='); if(k) c[k] = decodeURIComponent(v||''); }); return c; }

function jsonReply(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, { 'Content-Type':'application/json; charset=utf-8', 'Access-Control-Allow-Origin':BASE_URL, 'Access-Control-Allow-Credentials':'true' });
  res.end(body);
}

function readBody(req, max) {
  max = max || 10240;
  return new Promise((resolve, reject) => {
    let body = '', total = 0, done = false;
    const timer = setTimeout(() => { if (!done) { done = true; req.destroy(); reject(new Error('timeout')); } }, 5000);
    req.on('data', chunk => {
      total += chunk.length;
      if (total > max) { if (!done) { done = true; clearTimeout(timer); req.destroy(); reject(new Error('too large')); } return; }
      body += chunk;
    });
    req.on('end', () => { clearTimeout(timer); if (!done) resolve(body); });
    req.on('error', e => { clearTimeout(timer); if (!done) reject(e); });
  });
}

function ghReq(opts, post) {
  return new Promise((resolve, reject) => {
    const r = https.request(opts, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{resolve(JSON.parse(d));}catch(e){resolve(d);} }); });
    r.on('error', reject);
    r.setTimeout(10000, () => { r.destroy(); reject(new Error('timeout')); });
    if (post) r.write(post);
    r.end();
  });
}

const server = http.createServer(async (req, res) => {
  const timer = setTimeout(() => { if (!res.headersSent) { res.writeHead(504); res.end('Timeout'); } }, 30000);
  res.on('finish', () => clearTimeout(timer));
  res.on('close', () => clearTimeout(timer));
  try { await handle(req, res); } catch(e) {
    console.error('[ERR]', e);
    if (!res.headersSent) { res.writeHead(500); res.end('Error'); }
  }
});

async function handle(req, res) {
  const parsed = url.parse(req.url, true);
  let pathname;
  try { pathname = decodeURIComponent(parsed.pathname); } catch(e) { pathname = parsed.pathname; }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin':BASE_URL, 'Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers':'Content-Type', 'Access-Control-Allow-Credentials':'true' });
    return res.end();
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  if (pathname.startsWith('/api/') && !checkRate(ip+':api', 120)) return jsonReply(res, 429, { error: 'rate limit' });
  if (pathname === '/api/messages' && req.method === 'POST' && !checkRate(ip+':msg', 5)) return jsonReply(res, 429, { error: 'slow down' });
  if (pathname === '/api/links' && req.method === 'POST' && !checkRate(ip+':link', 3)) return jsonReply(res, 429, { error: 'slow down' });
  if (pathname === '/api/login' && req.method === 'GET' && !checkRate(ip+':login', 10)) return jsonReply(res, 429, { error: 'slow down' });

  // OAuth login
  if (pathname === '/api/login' && req.method === 'GET') {
    const state = genToken();
    const sess = readJSON(SESSIONS_FILE, {});
    sess['pending_'+state] = Date.now();
    writeJSON(SESSIONS_FILE, sess);
    res.writeHead(302, { Location: `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=read:user&state=${state}` });
    return res.end();
  }

  // OAuth callback
  if (pathname === '/api/callback' && req.method === 'GET') {
    const { code, state } = parsed.query;
    if (!code) { res.writeHead(400); return res.end('Missing code'); }
    const sess = readJSON(SESSIONS_FILE, {});
    if (!sess['pending_'+state]) { res.writeHead(302, { Location: '/contact.html?login=failed' }); return res.end(); }
    try {
      const tr = await ghReq({ hostname:'github.com', path:'/login/oauth/access_token', method:'POST', headers:{'Accept':'application/json','Content-Type':'application/json','User-Agent':'sunny-blog'} }, JSON.stringify({client_id:GITHUB_CLIENT_ID,client_secret:GITHUB_CLIENT_SECRET,code,state}));
      if (!tr.access_token) { res.writeHead(302, { Location: '/contact.html?login=failed' }); return res.end(); }
      const ur = await ghReq({ hostname:'api.github.com', path:'/user', method:'GET', headers:{'Authorization':'token '+tr.access_token,'User-Agent':'sunny-blog','Accept':'application/json'} });
      const tk = genToken();
      sess[tk] = { login:ur.login, name:(ur.name||ur.login).substring(0,100), avatar:(ur.avatar_url||'').substring(0,500), token:tr.access_token, created:Date.now() };
      delete sess['pending_'+state];
      cleanSessions(sess);
      writeJSON(SESSIONS_FILE, sess);
      res.writeHead(302, { Location:'/contact.html', 'Set-Cookie':`session=${tk}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL/1000}` });
      return res.end();
    } catch(e) { console.error('OAuth:', e); res.writeHead(302, { Location: '/contact.html?login=failed' }); return res.end(); }
  }

  if (pathname === '/api/user' && req.method === 'GET') {
    const c = parseCookies(req); const s = readJSON(SESSIONS_FILE, {}); const sess = s[c.session];
    if (!sess || (sess.created && Date.now()-sess.created > SESSION_TTL)) return jsonReply(res, 200, { logged_in:false });
    return jsonReply(res, 200, { logged_in:true, login:sess.login, name:sess.name, avatar:sess.avatar });
  }

  if (pathname === '/api/logout' && req.method === 'POST') {
    const c = parseCookies(req); const s = readJSON(SESSIONS_FILE, {});
    delete s[c.session]; writeJSON(SESSIONS_FILE, s);
    res.writeHead(200, { 'Set-Cookie':'session=; Path=/; HttpOnly; Max-Age=0' }); return res.end('ok');
  }

  if (pathname === '/api/messages' && req.method === 'GET') return jsonReply(res, 200, readJSON(MESSAGES_FILE, []));

  if (pathname === '/api/messages' && req.method === 'POST') {
    const c = parseCookies(req); const s = readJSON(SESSIONS_FILE, {}); const sess = s[c.session];
    let body; try { body = JSON.parse(await readBody(req, 4096)); } catch(e) { if (!res.headersSent) return jsonReply(res, 400, { error: 'bad body' }); return; }
    const content = stripHTML(body.content||'').trim().substring(0, 2000);
    if (!content) return jsonReply(res, 400, { error: 'empty' });
    const msg = { id:Date.now().toString(36)+crypto.randomBytes(4).toString('hex'), content, anonymous:!!body.anonymous, author:body.anonymous?'Anonymous':(sess?sess.name:'Guest'), avatar:body.anonymous?null:(sess?sess.avatar:null), login:body.anonymous?null:(sess?sess.login:null), timestamp:Date.now() };
    const msgs = readJSON(MESSAGES_FILE, []); msgs.unshift(msg); if (msgs.length>MAX_MESSAGES) msgs.length=MAX_MESSAGES;
    writeJSON(MESSAGES_FILE, msgs); return jsonReply(res, 200, msg);
  }

  if (pathname === '/api/messages' && req.method === 'DELETE') {
    const c = parseCookies(req); const s = readJSON(SESSIONS_FILE, {}); const sess = s[c.session];
    if (!sess) return jsonReply(res, 401, { error: 'login required' });
    let body; try { body = JSON.parse(await readBody(req, 1024)); } catch(e) { if (!res.headersSent) return jsonReply(res, 400, { error: 'bad body' }); return; }
    const msgs = readJSON(MESSAGES_FILE, []); const idx = msgs.findIndex(m => m.id===body.id && (m.login===sess.login || sess.login==='Christina0929'));
    if (idx===-1) return jsonReply(res, 404, { error: 'not found' });
    msgs.splice(idx, 1); writeJSON(MESSAGES_FILE, msgs); return jsonReply(res, 200, { ok:true });
  }

  if (pathname === '/api/links' && req.method === 'GET') return jsonReply(res, 200, readJSON(LINKS_FILE, []));

  if (pathname === '/api/links' && req.method === 'POST') {
    const c = parseCookies(req); const s = readJSON(SESSIONS_FILE, {}); const sess = s[c.session];
    if (!sess) return jsonReply(res, 401, { error: 'login required' });
    let body; try { body = JSON.parse(await readBody(req, 4096)); } catch(e) { if (!res.headersSent) return jsonReply(res, 400, { error: 'bad body' }); return; }
    let siteUrl = (body.site_url||'').trim().substring(0, 300);
    if (siteUrl && !/^https?:\/\/.+/i.test(siteUrl)) siteUrl = 'https://' + siteUrl;
    const link = { id:Date.now().toString(36)+crypto.randomBytes(4).toString('hex'), site_name:stripHTML(body.site_name||'').substring(0,100), site_url:siteUrl, site_desc:stripHTML(body.site_desc||'').substring(0,200), site_avatar:(body.site_avatar||'').trim().substring(0,500), author:sess.name, login:sess.login, timestamp:Date.now(), approved:false };
    if (!link.site_name || !link.site_url) return jsonReply(res, 400, { error: 'name and url required' });
    const links = readJSON(LINKS_FILE, []); links.unshift(link); writeJSON(LINKS_FILE, links); return jsonReply(res, 200, link);
  }

  if (pathname === '/api/links' && req.method === 'DELETE') {
    const c = parseCookies(req); const s = readJSON(SESSIONS_FILE, {}); const sess = s[c.session];
    if (!sess || sess.login!=='Christina0929') return jsonReply(res, 403, { error: 'forbidden' });
    let body; try { body = JSON.parse(await readBody(req, 1024)); } catch(e) { if (!res.headersSent) return jsonReply(res, 400, { error: 'bad body' }); return; }
    const links = readJSON(LINKS_FILE, []); const idx = links.findIndex(l => l.id===body.id);
    if (idx===-1) return jsonReply(res, 404, { error: 'not found' });
    links.splice(idx, 1); writeJSON(LINKS_FILE, links); return jsonReply(res, 200, { ok:true });
  }

  if (pathname === '/api/links/approve' && req.method === 'POST') {
    const c = parseCookies(req); const s = readJSON(SESSIONS_FILE, {}); const sess = s[c.session];
    if (!sess || sess.login!=='Christina0929') return jsonReply(res, 403, { error: 'forbidden' });
    let body; try { body = JSON.parse(await readBody(req, 1024)); } catch(e) { if (!res.headersSent) return jsonReply(res, 400, { error: 'bad body' }); return; }
    const links = readJSON(LINKS_FILE, []); const link = links.find(l => l.id===body.id);
    if (!link) return jsonReply(res, 404, { error: 'not found' });
    link.approved = true; writeJSON(LINKS_FILE, links); return jsonReply(res, 200, link);
  }

  // Static files
  let fp = path.join(SITE, pathname==='/' ? 'index.html' : pathname);
  fp = path.normalize(fp);
  if (!fp.startsWith(SITE)) { res.writeHead(403); return res.end(); }
  const rel = path.relative(SITE, fp);
  if (rel.split(path.sep).some(s => s.startsWith('.'))) { res.writeHead(403); return res.end(); }

  fs.stat(fp, (err, stat) => {
    if (err) { res.writeHead(404, {'Content-Type':'text/html; charset=utf-8'}); return res.end('<h1>404</h1>'); }
    if (stat.isDirectory()) fp = path.join(fp, 'index.html');
    fs.stat(fp, (e2, st2) => {
      if (e2) { res.writeHead(404, {'Content-Type':'text/html; charset=utf-8'}); return res.end('<h1>404</h1>'); }
      const ext = path.extname(fp).toLowerCase();
      const ct = MIME[ext] || 'application/octet-stream';
      const isThumb = fp.includes('pic'+path.sep+'thumb') || fp.includes('pic/thumb');
      const cc = (ext==='.mp3'||ext==='.ogg'||ext==='.opus') ? 'public, max-age=604800' : isThumb ? 'public, max-age=2592000' : (ext==='.html'||ext==='.js'||ext==='.css') ? 'no-cache' : 'public, max-age=3600';

      const range = req.headers.range;
      if (range) {
        const m = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (m) {
          const sz = st2.size; let s = m[1]===''?null:parseInt(m[1],10), e = m[2]===''?null:parseInt(m[2],10);
          if (s===null) { s=Math.max(sz-e,0); e=sz-1; } else { if (e===null||e>=sz) e=sz-1; }
          if (s>e||s>=sz) { res.writeHead(416,{'Content-Range':'bytes */'+sz}); return res.end(); }
          res.writeHead(206, {'Content-Type':ct,'Accept-Ranges':'bytes','Cache-Control':cc,'Content-Length':e-s+1,'Content-Range':`bytes ${s}-${e}/${sz}`});
          return fs.createReadStream(fp,{start:s,end:e}).pipe(res);
        }
      }

      const ae = req.headers['accept-encoding']||'';
      const mb = ct.split(';')[0].trim();
      if (ae.includes('gzip') && COMPRESSIBLE.has(mb) && st2.size > 256) {
        res.writeHead(200, {'Content-Type':ct,'Content-Encoding':'gzip','Accept-Ranges':'bytes','Cache-Control':cc,'Vary':'Accept-Encoding'});
        return fs.createReadStream(fp).pipe(zlib.createGzip({level:6})).pipe(res);
      }

      fs.readFile(fp, (e3, content) => {
        if (e3) { res.writeHead(500); return res.end('Error'); }
        res.writeHead(200, {'Content-Type':ct,'Accept-Ranges':'bytes','Cache-Control':cc});
        res.end(content);
      });
    });
  });
}

process.on('uncaughtException', e => console.error('[FATAL]', e));
process.on('unhandledRejection', e => console.error('[WARN]', e));
setInterval(() => { const s = readJSON(SESSIONS_FILE, {}); if (cleanSessions(s)) writeJSON(SESSIONS_FILE, s); }, 3600000);

server.listen(PORT, () => {
  console.log(`Server: ${BASE_URL}`);
  console.log('OAuth callback: ' + BASE_URL + '/api/callback');
});
