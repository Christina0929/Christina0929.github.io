/* 晴天小站 · Node.js 静态服务器 + GitHub OAuth + 留言板
 * 日志: D:\Default Project\对话日志\2026-08-28.txt
 * 回滚: 用 server.js.bak-YYYYMMDD 恢复 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');
const zlib = require('zlib');

const PORT = 8765;
const GITHUB_CLIENT_ID = 'Ov23limaL8KEDjRchSqE';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '568d9b6f35c5c4f058c90c71cf523039b649e64a';
const BASE_URL = 'http://localhost:' + PORT;
const SITE = path.join(__dirname);

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const LINKS_FILE = path.join(DATA_DIR, 'links.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch(e) { return fallback; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
};

// 可压缩的 MIME 类型
const COMPRESSIBLE = new Set([
  'text/html', 'text/css', 'text/javascript', 'application/javascript',
  'application/json', 'image/svg+xml', 'text/plain', 'text/xml',
]);

function parseCookies(req) {
  const cookies = {};
  (req.headers.cookie || '').split(';').forEach(c => {
    const [k, v] = c.trim().split('=');
    if (k) cookies[k] = decodeURIComponent(v || '');
  });
  return cookies;
}

function jsonReply(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': BASE_URL,
    'Access-Control-Allow-Credentials': 'true',
  });
  res.end(body);
}

// 读取 POST body，限制大小防滥用
function readBody(req, maxBytes) {
  maxBytes = maxBytes || 10240; // 默认 10KB
  return new Promise((resolve, reject) => {
    let body = '';
    let total = 0;
    req.on('data', chunk => {
      total += chunk.length;
      if (total > maxBytes) { req.destroy(); reject(new Error('Body too large')); return; }
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function ghRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { resolve(data); }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = decodeURIComponent(parsed.pathname);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': BASE_URL,
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
    });
    return res.end();
  }

  // === API ROUTES ===

  // GitHub OAuth login
  if (pathname === '/api/login' && req.method === 'GET') {
    const state = generateToken();
    const sessions = readJSON(SESSIONS_FILE, {});
    sessions['pending_' + state] = Date.now();
    writeJSON(SESSIONS_FILE, sessions);
    const ghUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=read:user&state=${state}`;
    res.writeHead(302, { Location: ghUrl });
    return res.end();
  }

  // GitHub OAuth callback
  if (pathname === '/api/callback' && req.method === 'GET') {
    const code = parsed.query.code;
    const state = parsed.query.state;
    if (!code) { res.writeHead(400); return res.end('Missing code'); }
    try {
      const tokenRes = await ghRequest({
        hostname: 'github.com',
        path: '/login/oauth/access_token',
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'sunny-blog' },
      }, JSON.stringify({ client_id: GITHUB_CLIENT_ID, client_secret: GITHUB_CLIENT_SECRET, code, state }));

      if (!tokenRes.access_token) {
        res.writeHead(302, { Location: '/contact.html?login=failed' });
        return res.end();
      }

      const userRes = await ghRequest({
        hostname: 'api.github.com',
        path: '/user',
        method: 'GET',
        headers: { 'Authorization': 'token ' + tokenRes.access_token, 'User-Agent': 'sunny-blog', 'Accept': 'application/json' },
      });

      const sessionToken = generateToken();
      const sessions = readJSON(SESSIONS_FILE, {});
      sessions[sessionToken] = {
        login: userRes.login,
        name: userRes.name || userRes.login,
        avatar: userRes.avatar_url,
        token: tokenRes.access_token,
        created: Date.now(),
      };
      writeJSON(SESSIONS_FILE, sessions);

      // Clean pending
      delete sessions['pending_' + state];
      writeJSON(SESSIONS_FILE, sessions);

      res.writeHead(302, {
        Location: '/contact.html',
        'Set-Cookie': `session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax`,
      });
      return res.end();
    } catch(e) {
      console.error('OAuth error:', e);
      res.writeHead(500);
      return res.end('Server error');
    }
  }

  // Get current user
  if (pathname === '/api/user' && req.method === 'GET') {
    const cookies = parseCookies(req);
    const sessions = readJSON(SESSIONS_FILE, {});
    const session = sessions[cookies.session];
    if (!session) return jsonReply(res, 200, { logged_in: false });
    return jsonReply(res, 200, {
      logged_in: true,
      login: session.login,
      name: session.name,
      avatar: session.avatar,
    });
  }

  // Logout
  if (pathname === '/api/logout' && req.method === 'POST') {
    const cookies = parseCookies(req);
    const sessions = readJSON(SESSIONS_FILE, {});
    delete sessions[cookies.session];
    writeJSON(SESSIONS_FILE, sessions);
    res.writeHead(200, { 'Set-Cookie': 'session=; Path=/; HttpOnly; Max-Age=0' });
    return res.end('ok');
  }

  // Get messages
  if (pathname === '/api/messages' && req.method === 'GET') {
    const messages = readJSON(MESSAGES_FILE, []);
    return jsonReply(res, 200, messages);
  }

  // Post message
  if (pathname === '/api/messages' && req.method === 'POST') {
    const cookies = parseCookies(req);
    const sessions = readJSON(SESSIONS_FILE, {});
    const session = sessions[cookies.session];
    let body;
    try { body = JSON.parse(await readBody(req, 4096)); } catch(e) { return jsonReply(res, 400, { error: 'Invalid body' }); }

    const msg = {
      id: Date.now().toString(36) + crypto.randomBytes(4).toString('hex'),
      content: (body.content || '').trim().substring(0, 2000),
      anonymous: !!body.anonymous,
      author: body.anonymous ? 'Anonymous' : (session ? session.name : 'Guest'),
      avatar: body.anonymous ? null : (session ? session.avatar : null),
      login: body.anonymous ? null : (session ? session.login : null),
      timestamp: Date.now(),
    };

    if (!msg.content) return jsonReply(res, 400, { error: 'Content required' });

    const messages = readJSON(MESSAGES_FILE, []);
    messages.unshift(msg);
    if (messages.length > 200) messages.length = 200;
    writeJSON(MESSAGES_FILE, messages);
    return jsonReply(res, 200, msg);
  }

  // Delete message
  if (pathname === '/api/messages' && req.method === 'DELETE') {
    const cookies = parseCookies(req);
    const sessions = readJSON(SESSIONS_FILE, {});
    const session = sessions[cookies.session];
    if (!session) return jsonReply(res, 401, { error: 'Not logged in' });
    let body;
    try { body = JSON.parse(await readBody(req, 1024)); } catch(e) { return jsonReply(res, 400, { error: 'Invalid body' }); }
    const messages = readJSON(MESSAGES_FILE, []);
    const idx = messages.findIndex(m => m.id === body.id && (m.login === session.login || session.login === 'Christina0929'));
    if (idx === -1) return jsonReply(res, 404, { error: 'Not found' });
    messages.splice(idx, 1);
    writeJSON(MESSAGES_FILE, messages);
    return jsonReply(res, 200, { ok: true });
  }

  // Get friend links
  if (pathname === '/api/links' && req.method === 'GET') {
    const links = readJSON(LINKS_FILE, []);
    return jsonReply(res, 200, links);
  }

  // Submit friend link
  if (pathname === '/api/links' && req.method === 'POST') {
    const cookies = parseCookies(req);
    const sessions = readJSON(SESSIONS_FILE, {});
    const session = sessions[cookies.session];
    if (!session) return jsonReply(res, 401, { error: 'Login required' });
    let body;
    try { body = JSON.parse(await readBody(req, 4096)); } catch(e) { return jsonReply(res, 400, { error: 'Invalid body' }); }
    const link = {
      id: Date.now().toString(36) + crypto.randomBytes(4).toString('hex'),
      site_name: (body.site_name || '').trim().substring(0, 100),
      site_url: (body.site_url || '').trim().substring(0, 300),
      site_desc: (body.site_desc || '').trim().substring(0, 200),
      site_avatar: (body.site_avatar || '').trim().substring(0, 500),
      author: session.name,
      login: session.login,
      timestamp: Date.now(),
      approved: false,
    };
    if (!link.site_name || !link.site_url) return jsonReply(res, 400, { error: 'Name and URL required' });
    const links = readJSON(LINKS_FILE, []);
    links.unshift(link);
    writeJSON(LINKS_FILE, links);
    return jsonReply(res, 200, link);
  }

  // Approve/delete link (site owner only)
  if (pathname === '/api/links' && req.method === 'DELETE') {
    const cookies = parseCookies(req);
    const sessions = readJSON(SESSIONS_FILE, {});
    const session = sessions[cookies.session];
    if (!session || session.login !== 'Christina0929') return jsonReply(res, 403, { error: 'Forbidden' });
    let body;
    try { body = JSON.parse(await readBody(req, 1024)); } catch(e) { return jsonReply(res, 400, { error: 'Invalid body' }); }
    const links = readJSON(LINKS_FILE, []);
    const idx = links.findIndex(l => l.id === body.id);
    if (idx === -1) return jsonReply(res, 404, { error: 'Not found' });
    links.splice(idx, 1);
    writeJSON(LINKS_FILE, links);
    return jsonReply(res, 200, { ok: true });
  }

  // Approve link
  if (pathname === '/api/links/approve' && req.method === 'POST') {
    const cookies = parseCookies(req);
    const sessions = readJSON(SESSIONS_FILE, {});
    const session = sessions[cookies.session];
    if (!session || session.login !== 'Christina0929') return jsonReply(res, 403, { error: 'Forbidden' });
    let body;
    try { body = JSON.parse(await readBody(req, 1024)); } catch(e) { return jsonReply(res, 400, { error: 'Invalid body' }); }
    const links = readJSON(LINKS_FILE, []);
    const link = links.find(l => l.id === body.id);
    if (!link) return jsonReply(res, 404, { error: 'Not found' });
    link.approved = true;
    writeJSON(LINKS_FILE, links);
    return jsonReply(res, 200, link);
  }

  // === STATIC FILES ===
  let filePath = path.join(SITE, pathname === '/' ? 'index.html' : pathname);
  filePath = path.normalize(filePath);
  if (!filePath.startsWith(SITE)) { res.writeHead(403); return res.end(); }

  // 异步读取静态文件（不阻塞事件循环）
  fs.stat(filePath, (err, stat) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<h1>404</h1>');
    }
    if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');

    // 重新 stat（可能变成了 index.html）
    fs.stat(filePath, (err2, stat2) => {
      if (err2) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end('<h1>404</h1>');
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME[ext] || 'application/octet-stream';

      // 缓存策略：
      // - mp3/ogg/opus: 7 天（音频文件不变）
      // - thumb 缩略图: 30 天（生成后不变）
      // - 其他图片: 1 小时
      // - html/js/css: no-cache（开发期要即时更新）
      const isThumb = filePath.includes('pic/thumb/');
      const cacheControl =
        ext === '.mp3' || ext === '.ogg' || ext === '.opus' ? 'public, max-age=604800' :
        isThumb ? 'public, max-age=2592000' :
        ext === '.html' || ext === '.js' || ext === '.css' ? 'no-cache' :
        'public, max-age=3600';

      // === Range 请求支持（音频 seek 必需）===
      const range = req.headers.range;
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (match) {
          const size = stat2.size;
          let start = match[1] === '' ? null : parseInt(match[1], 10);
          let end = match[2] === '' ? null : parseInt(match[2], 10);
          if (start === null) {
            const suffix = end;
            start = Math.max(size - suffix, 0);
            end = size - 1;
          } else {
            if (end === null || end >= size) end = size - 1;
          }
          if (start > end || start >= size) {
            res.writeHead(416, { 'Content-Range': 'bytes */' + size });
            return res.end();
          }
          const stream = fs.createReadStream(filePath, { start, end });
          res.writeHead(206, {
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
            'Cache-Control': cacheControl,
            'Content-Length': end - start + 1,
            'Content-Range': `bytes ${start}-${end}/${size}`,
          });
          return stream.pipe(res);
        }
      }

      // === gzip 压缩 ===
      const acceptEncoding = req.headers['accept-encoding'] || '';
      const mimeBase = contentType.split(';')[0].trim();
      if (acceptEncoding.includes('gzip') && COMPRESSIBLE.has(mimeBase) && stat2.size > 256) {
        const headers = {
          'Content-Type': contentType,
          'Content-Encoding': 'gzip',
          'Accept-Ranges': 'bytes',
          'Cache-Control': cacheControl,
          'Vary': 'Accept-Encoding',
        };
        res.writeHead(200, headers);
        const gzip = zlib.createGzip({ level: 6 });
        fs.createReadStream(filePath).pipe(gzip).pipe(res);
        return;
      }

      // 无压缩，异步读取
      fs.readFile(filePath, (err3, content) => {
        if (err3) {
          res.writeHead(500);
          return res.end('Server error');
        }
        res.writeHead(200, { 'Content-Type': contentType, 'Accept-Ranges': 'bytes', 'Cache-Control': cacheControl });
        res.end(content);
      });
    });
  });
});

server.listen(PORT, () => {
  console.log(`Server running at ${BASE_URL}`);
  console.log('GitHub OAuth callback: ' + BASE_URL + '/api/callback');
});
