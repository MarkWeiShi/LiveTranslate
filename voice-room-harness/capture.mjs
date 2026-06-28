// 语聊房逆向采集（Playwright）—— 按 voice-room-browser-harness.md 实现。
// 用法：
//   node capture.mjs <url> <stateName> [--headful] [--wait] [--mobile]
//   HEADFUL=1 node capture.mjs https://www.bigo.tv/ homepage --wait
// 产出：out/<stateName>.png（截图）+ out/<stateName>_dom.json（DOM 树）+ out/ws_frames.json（WS 帧）
// 需要登录 / 进真实语聊房时用 --headful --wait：脚本会暂停，你在浏览器里手动操作后回车继续。
import { chromium, devices } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const url = process.argv[2];
const stateName = process.argv[3] ?? 'capture';
const headful = process.argv.includes('--headful') || process.env.HEADFUL === '1';
const wait = process.argv.includes('--wait');
const mobile = process.argv.includes('--mobile');
if (!url) { console.error('usage: node capture.mjs <url> <stateName> [--headful] [--wait] [--mobile]'); process.exit(1); }

const OUT = fileURLToPath(new URL('./out/', import.meta.url));
const wsFrames = [];

function ask(q) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(q, (a) => { rl.close(); res(a); }));
}

async function snapshot(page, name) {
  await page.screenshot({ path: `${OUT}${name}.png`, fullPage: false });
  const dom = await page.evaluate((maxDepth) => {
    function walk(el, depth) {
      if (depth > maxDepth || !el) return null;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return null;
      return {
        tag: el.tagName?.toLowerCase(),
        role: el.getAttribute?.('role') || undefined,
        label: el.getAttribute?.('aria-label') || undefined,
        cls: (el.className?.toString?.() || '').split(' ').filter(Boolean).slice(0, 4),
        text: el.children.length === 0 ? (el.textContent || '').trim().slice(0, 60) || undefined : undefined,
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        children: [...el.children].map((c) => walk(c, depth + 1)).filter(Boolean),
      };
    }
    return walk(document.body, 0);
  }, 9);
  await writeFile(`${OUT}${name}_dom.json`, JSON.stringify(dom, null, 2));
  console.log(`  ✓ ${name}.png + _dom.json`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    headless: !headful,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const context = await browser.newContext({
    ...(mobile ? devices['iPhone 14'] : { viewport: { width: 1280, height: 800 } }),
    permissions: ['microphone'],
  });
  const page = await context.newPage();

  // WebSocket 帧拦截（礼物/弹幕/上麦协议草图）
  page.on('websocket', (ws) => {
    const rec = (dir) => (data) => {
      const payload = typeof data === 'string' ? data : '[binary]';
      wsFrames.push({ ts: Date.now(), dir, url: ws.url().slice(0, 80), payload: payload.slice(0, 400) });
    };
    ws.on('framereceived', (f) => rec('in')(f.payload));
    ws.on('framesent', (f) => rec('out')(f.payload));
  });

  console.log(`→ goto ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => console.warn('goto warn:', e.message));
  await page.waitForTimeout(3500);
  await snapshot(page, stateName);

  if (wait) {
    // 手动登录 / 进语聊房 / 打开礼物面板 / 送礼，每步回车抓一张
    let i = 1;
    for (;;) {
      const name = await ask('\n输入状态名抓快照（如 room_entry / gift_panel_open / gift_sending），直接回车结束：');
      if (!name.trim()) break;
      await snapshot(page, name.trim() || `state${i++}`);
    }
  }

  await writeFile(`${OUT}ws_frames.json`, JSON.stringify(wsFrames.slice(0, 2000), null, 2));
  console.log(`\n✅ 完成。产物在 ${OUT}（含 ws_frames.json ${wsFrames.length} 帧）`);
  await context.close();
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
