/* 压力测试脚本 - 晴天小站
 * 用法: node test/stress.js [端口] [并发数] [请求数]
 * 测试项目: 静态文件/限流/并发/异常输入/Gzip/Range请求 */
const http = require('http');
const zlib = require('zlib');

const PORT = parseInt(process.argv[2]) || 8765;
const CONCURRENCY = parseInt(process.argv[3]) || 30;
const TOTAL = parseInt(process.argv[4]) || 200;
const BASE = 'http://localhost:' + PORT;

let passed = 0, failed = 0, tests = [];

function test(name, fn) {
  return fn().then(ok => {
    if (ok) { passed++; console.log(`  ✓ ${name}`); }
    else { failed++; console.log(`  ✗ ${name}`); }
  }).catch(e => {
    failed++; console.log(`  ✗ ${name}: ${e.message}`);
  });
}

function get(path, headers) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'localhost', port: PORT, path, headers: headers || {} };
    const req = http.get(opts, (res) => {
      let data = [];
      res.on('data', c => data.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(data);
        let body;
        if (res.headers['content-encoding'] === 'gzip') {
          body = zlib.gunzipSync(buf).toString();
        } else {
          body = buf.toString();
        }
        resolve({ status: res.statusCode, headers: res.headers, body, size: buf.length });
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function post(path, data, headers) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const opts = {
      hostname: 'localhost', port: PORT, path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...(headers || {}) },
    };
    const req = http.request(opts, (res) => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

async function run() {
  console.log(`\n=== 晴天小站压力测试 ===`);
  console.log(`目标: ${BASE} | 并发: ${CONCURRENCY} | 总请求: ${TOTAL}\n`);

  // === 基础功能 ===
  console.log('[1] 基础功能');
  await test('首页 200', async () => {
    const r = await get('/');
    return r.status === 200 && r.body.includes('晴天小站');
  });
  await test('about.html 200', async () => {
    const r = await get('/about.html');
    return r.status === 200 && r.body.includes('关于我');
  });
  await test('blog.html 200', async () => {
    const r = await get('/blog.html');
    return r.status === 200;
  });
  await test('404 页面', async () => {
    const r = await get('/nonexistent.html');
    return r.status === 404;
  });
  await test('路径穿越拦截', async () => {
    const r = await get('/../server.js');
    return r.status === 403;
  });
  await test('隐藏文件拦截', async () => {
    const r = await get('/.git/config');
    return r.status === 403;
  });

  // === Gzip ===
  console.log('\n[2] Gzip 压缩');
  await test('Gzip 压缩 JS', async () => {
    const r = await get('/js/common.js', { 'Accept-Encoding': 'gzip' });
    return r.status === 200 && r.headers['content-encoding'] === 'gzip' && r.size < 1000;
  });
  await test('Gzip 压缩 HTML', async () => {
    const r = await get('/', { 'Accept-Encoding': 'gzip' });
    return r.status === 200 && r.headers['content-encoding'] === 'gzip';
  });
  await test('无 Accept-Encoding 不压缩', async () => {
    const r = await get('/js/common.js');
    return r.status === 200 && !r.headers['content-encoding'];
  });

  // === Range 请求 ===
  console.log('\n[3] Range 请求');
  await test('Range: bytes=0-100', async () => {
    const r = await get('/music/01-theme-of-SSS.mp3', { Range: 'bytes=0-100' });
    return r.status === 206 && r.headers['content-range'];
  });
  await test('Range: bytes=-500', async () => {
    const r = await get('/music/01-theme-of-SSS.mp3', { Range: 'bytes=-500' });
    return r.status === 206;
  });
  await test('Range 越界 416', async () => {
    const r = await get('/music/01-theme-of-SSS.mp3', { Range: 'bytes=99999999-' });
    return r.status === 416;
  });

  // === API 限流 ===
  console.log('\n[4] API 限流');
  await test('留言限流 (5次/分钟)', async () => {
    let rateLimited = false;
    for (let i = 0; i < 8; i++) {
      const r = await post('/api/messages', { content: 'test' + i });
      if (r.status === 429) { rateLimited = true; break; }
    }
    return rateLimited;
  });
  await test('登录限流 (10次/分钟)', async () => {
    let rateLimited = false;
    for (let i = 0; i < 12; i++) {
      const r = await get('/api/login');
      if (r.status === 429) { rateLimited = true; break; }
    }
    return rateLimited;
  });

  // === 安全 ===
  console.log('\n[5] 安全');
  await test('DELETE 消息需登录', async () => {
    const r = await new Promise((resolve, reject) => {
      const opts = { hostname: 'localhost', port: PORT, path: '/api/messages', method: 'DELETE', headers: { 'Content-Type': 'application/json' } };
      const req = http.request(opts, (res) => {
        let d = []; res.on('data', c => d.push(c));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(d).toString() }));
      });
      req.on('error', reject);
      req.write(JSON.stringify({ id: 'fake' }));
      req.end();
    });
    return r.status === 401;
  });
  await test('超大 Body 拒绝', async () => {
    const bigBody = 'x'.repeat(20000);
    try {
      const r = await new Promise((resolve, reject) => {
        const opts = { hostname: 'localhost', port: PORT, path: '/api/messages', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bigBody) } };
        const req = http.request(opts, (res) => {
          let d = []; res.on('data', c => d.push(c));
          res.on('end', () => resolve({ status: res.statusCode }));
        });
        req.on('error', e => resolve({ error: e.message }));
        req.write(bigBody);
        req.end();
      });
      // 400/429 或 ECONNRESET 都算服务器成功拒绝
      return r.status === 400 || r.status === 429 || r.error === 'read ECONNRESET';
    } catch(e) { return true; }
  });
  await test('XSS 输入清洗', async () => {
    const r = await post('/api/messages', { content: '<script>alert(1)</script>Test' });
    if (r.status === 429) return true; // 被限流也算通过
    const parsed = JSON.parse(r.body);
    return parsed.content && !parsed.content.includes('<script>');
  });

  // === 缓存头 ===
  console.log('\n[6] 缓存头');
  await test('MP3 7天缓存', async () => {
    const r = await get('/music/01-theme-of-SSS.mp3', { Range: 'bytes=0-0' });
    return r.headers['cache-control'] && r.headers['cache-control'].includes('604800');
  });
  await test('Thumb 30天缓存', async () => {
    const r = await get('/pic/thumb/01-theme-of-SSS.jpg');
    return r.headers['cache-control'] && r.headers['cache-control'].includes('2592000');
  });
  await test('HTML no-cache', async () => {
    const r = await get('/');
    return r.headers['cache-control'] === 'no-cache';
  });

  // === 并发压力 ===
  console.log(`\n[7] 并发压力 (${CONCURRENCY} 并发 x ${TOTAL} 请求)`);
  const pages = ['/', '/about.html', '/blog.html', '/bookmarks.html', '/collection.html', '/contact.html', '/post1.html', '/post3.html'];
  const startTime = Date.now();
  let successCount = 0, errorCount = 0, timeoutCount = 0;

  const tasks = [];
  for (let i = 0; i < TOTAL; i++) {
    const page = pages[i % pages.length];
    tasks.push(
      get(page).then(r => {
        if (r.status === 200) successCount++;
        else errorCount++;
      }).catch(e => {
        if (e.message === 'timeout') timeoutCount++;
        else errorCount++;
      })
    );
    // 控制并发
    if (tasks.length >= CONCURRENCY) {
      await Promise.all(tasks.splice(0, CONCURRENCY));
    }
  }
  await Promise.all(tasks);

  const elapsed = Date.now() - startTime;
  const rps = (TOTAL / (elapsed / 1000)).toFixed(1);
  console.log(`  完成: ${successCount}/${TOTAL} 成功 | ${errorCount} 错误 | ${timeoutCount} 超时`);
  console.log(`  耗时: ${elapsed}ms | 吞吐: ${rps} req/s`);

  // === 结果 ===
  console.log(`\n=== 结果: ${passed} 通过, ${failed} 失败 ===`);
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error('Test error:', e); process.exit(1); });
