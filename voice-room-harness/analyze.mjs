// 截图 + DOM → spec.json（Claude Vision）。按 voice-room-browser-harness.md 的 generate_specs 实现。
// 用法：ANTHROPIC_API_KEY=sk-... node analyze.mjs
// 读取 out/*.png + out/*_dom.json，逐个调 Claude，汇总 out/spec.json。
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.MODEL || 'claude-opus-4-8';
if (!KEY) { console.error('需要 ANTHROPIC_API_KEY'); process.exit(1); }
const OUT = fileURLToPath(new URL('./out/', import.meta.url));

const SYSTEM = `你是资深产品经理，逆向分析语聊房竞品 UI。给你一张截图和对应 DOM 树，输出严格 JSON：
{"state":"状态名","layout_pattern":"grid|stack|absolute|flex",
 "components":[{"id":"","name":"中文名","type":"button|text|avatar|icon|panel|list|overlay|animation",
   "position":{"x":0,"y":0,"w":0,"h":0},"visible_text":"","interaction":"tap|swipe|long_press|none",
   "state_variants":[],"notes":""}],
 "z_layers":[],"animations":[],"colors":[],"missing_info":[]}
只输出 JSON，不要 markdown 包裹。`;

async function analyze(name, pngPath, domPath) {
  const img = Buffer.from(await readFile(pngPath)).toString('base64');
  let dom = '{}';
  try { dom = JSON.stringify(JSON.parse(await readFile(domPath, 'utf8'))).slice(0, 6000); } catch { /* no dom */ }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL, max_tokens: 3000, system: SYSTEM,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: img } },
        { type: 'text', text: `状态：${name}\nDOM 树节选：\n${dom}` },
      ] }],
    }),
  });
  const j = await res.json();
  let raw = j?.content?.[0]?.text?.trim() ?? '';
  if (raw.startsWith('```')) raw = raw.replace(/^```(json)?\n/, '').replace(/```$/, '');
  try { return JSON.parse(raw); } catch { return { state: name, _raw: raw.slice(0, 500) }; }
}

async function main() {
  const files = (await readdir(OUT)).filter((f) => f.endsWith('.png'));
  const specs = {};
  for (const png of files) {
    const name = png.replace(/\.png$/, '');
    console.log(`分析 ${name}…`);
    specs[name] = await analyze(name, `${OUT}${png}`, `${OUT}${name}_dom.json`);
  }
  await writeFile(`${OUT}spec.json`, JSON.stringify(specs, null, 2));
  console.log(`\n✅ spec.json 已生成（${files.length} 个状态）→ ${OUT}spec.json`);
  console.log('把它喂给我，我据此把语聊房复刻到完全一致。');
}
main().catch((e) => { console.error(e); process.exit(1); });
