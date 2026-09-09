/* risk-eval/tests/calc.test.js — 计算引擎单元测试
 * 运行：node --test risk-eval/tests/calc.test.js（零依赖，Node 原生 node:test）
 * 依据：execution-contract.md Headroom H1 / H3，以及 PRD §5 边界与异常
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const Calc = require('../app.js');

const TABLE_A2 = [
  { params_b: 1.5, vram_g: 3, flops: '3.5×10^13' },
  { params_b: 7, vram_g: 13, flops: '1.7×10^14' },
  { params_b: 8, vram_g: 15, flops: '2×10^14' },
  { params_b: 14, vram_g: 26, flops: '3.5×10^14' },
  { params_b: 32, vram_g: 48, flops: '8×10^14' },
  { params_b: 70, vram_g: 130, flops: '1.7×10^15' },
  { params_b: 671, vram_g: 1250, flops: '1.7×10^16' }
];

/* H1：显存公式 A.1 —— M = (P × q / 8) × 1.2 */
test('calcVRAM: 7B 三种量化位数的显存值', () => {
  assert.strictEqual(Calc.calcVRAM(7, 16).value, 16.8, '7B/16bit 应为 16.8 GB');
  assert.strictEqual(Calc.calcVRAM(7, 8).value, 8.4, '7B/8bit 应为 8.4 GB');
  assert.strictEqual(Calc.calcVRAM(7, 4).value, 4.2, '7B/4bit 应为 4.2 GB');
  assert.strictEqual(Calc.calcVRAM(7, 16).level, 'A', '显存公式属 A 级标准依据');
});

/* H3：非法输入不得产生 NaN / Infinity */
test('calcVRAM: 非法输入返回 ok:false 且给出原因', () => {
  [0, -1, 'abc', '', null, undefined, NaN].forEach((bad) => {
    const r = Calc.calcVRAM(bad, 16);
    assert.strictEqual(r.ok, false, `参数量 ${String(bad)} 应被拒绝`);
    assert.ok(r.error && r.error.length > 0, '必须给出错误原因');
    assert.ok(!Number.isNaN(r.value), '不得返回 NaN');
  });
});

/* H1：参数量与训练数据量、算力 */
test('calcParams / calcTrainData / calcTrainFlops', () => {
  const p = Calc.calcParams(96, 12288);
  assert.strictEqual(p.ok, true);
  assert.ok(Math.abs(p.n - 12 * 96 * 12288 * 12288) < 1, 'N ≈ 12·L·h²');

  const d = Calc.calcTrainData(7e9);
  assert.strictEqual(d.d, 1.05e11, '7B 参数的数据量下限应为 1.05e11 tokens');

  const f = Calc.calcTrainFlops(7e9, 1.05e11);
  assert.strictEqual(f.flops, 6 * 7e9 * 1.05e11, '总算力应为 6ND');
  assert.strictEqual(f.level, 'A');
});

/* H1：并发三公式 */
test('并发公式 A.2 / A.3 / A.4', () => {
  const b2 = Calc.calcConcurrencyH(100, 0.5);
  assert.strictEqual(b2.value, 200, 'B = H / I = 100 / 0.5 = 200');
  assert.strictEqual(b2.ref, 'A.2');

  const b3 = Calc.calcConcurrencyTPS(10, 1, 0.05, 200);
  assert.strictEqual(b3.value, 110, 'B = 10 × (1 + 0.05 × 200) = 110');
  assert.strictEqual(b3.ref, 'A.3');

  const c = Calc.calcAvgConcurrency(1000, 300, 3600);
  assert.strictEqual(c.value, 83.33, 'C = 1000 × 300 / 3600 ≈ 83.33');
  assert.strictEqual(c.ref, 'A.4');
});

/* ADR-004：表 A.2 非档位取相邻，不插值 */
test('lookupFinetune: 档位命中 / 近似档位 / 越界', () => {
  const exact = Calc.lookupFinetune(70, TABLE_A2);
  assert.strictEqual(exact.vram_g, 130, '70B 应命中 130G');
  assert.strictEqual(exact.flops, '1.7×10^15');
  assert.strictEqual(exact.approx, false);
  assert.strictEqual(exact.outOfRange, false);

  const approx = Calc.lookupFinetune(13, TABLE_A2);
  assert.strictEqual(approx.approx, true, '13B 不在表内，应标记近似');
  assert.ok(approx.note.indexOf('非精确值') > -1, '必须提示非精确值');

  const over = Calc.lookupFinetune(1000, TABLE_A2);
  assert.strictEqual(over.outOfRange, true, '1000B 超出表 A.2 覆盖范围');
  assert.ok(over.note.indexOf('超出') > -1);
});

/* 表 A.3 压缩 */
test('applyCompression: 按表 A.3 压缩率计算', () => {
  assert.strictEqual(Calc.applyCompression(16.8, 0.5).value, 8.4, '8-bit 省 50%');
  assert.strictEqual(Calc.applyCompression(16.8, 0.75).value, 4.2, '4-bit GPTQ 省 75%');
  assert.strictEqual(Calc.applyCompression(16.8, 2).ok, false, '压缩率越界应被拒绝');
});

/* REQ-020：C 级函数必须带 level=C */
test('C 级估算函数带 level=C 标记', () => {
  const hw = Calc.matchHardware(16.8);
  assert.strictEqual(hw.ok, true);
  assert.strictEqual(hw.level, 'C', '硬件匹配属 C 级');

  const kv = Calc.estimateKVCache(32, 4096, 2048, 4, 2);
  assert.strictEqual(kv.ok, true);
  assert.strictEqual(kv.level, 'C', 'KV Cache 属 C 级');
  assert.ok(kv.note.indexOf('未给出') > -1, '必须声明标准未给公式');

  const missing = Calc.estimateKVCache(null, null, 2048, 4, 2);
  assert.strictEqual(missing.ok, false, '缺 L/h 时不得硬算');
});

/* 边界：所有数值路径不得出现 NaN / Infinity */
test('全函数非法输入不产生 NaN / Infinity', () => {
  const results = [
    Calc.calcVRAM(-5, 16), Calc.calcParams(0, 0), Calc.calcTrainData(-1),
    Calc.calcTrainFlops(1, -1), Calc.calcConcurrencyH(0, 1),
    Calc.calcConcurrencyTPS(1, -2, 1, 1), Calc.calcAvgConcurrency(1, 1, 0),
    Calc.lookupFinetune(0, TABLE_A2), Calc.matchHardware(-1)
  ];
  results.forEach((r) => {
    assert.strictEqual(r.ok, false, '非法输入应返回 ok:false');
    const json = JSON.stringify(r);
    assert.ok(json.indexOf('null') > -1 || r.error, '应带错误信息');
    assert.ok(!/NaN|Infinity/.test(json), '结果中不得出现 NaN/Infinity');
  });
});
