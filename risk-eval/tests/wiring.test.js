/* risk-eval/tests/wiring.test.js — 接线检查（防止「函数已测但未接入 UI」类缺陷回归）
 *
 * 背景：2026-09-09 审查发现 calcAvgConcurrency 有单元测试、有导出，但渲染层从未调用，
 *       导致 REQ-007 要求的第三个并发公式对用户不可用。单测全绿却功能缺失 = 测试盲区。
 * 本文件用静态断言守住「每个 A 级公式都必须在渲染层有调用点」。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const APP = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

/** 取出渲染层代码（Calc 模块之后的部分），避免把「定义处」误判为「调用处」 */
function renderLayer() {
  const marker = '/* ============================ 渲染层（仅浏览器） ============================ */';
  const i = APP.indexOf(marker);
  assert.notStrictEqual(i, -1, '未找到渲染层标记，app.js 结构可能已变更');
  return APP.slice(i);
}

const RENDER = renderLayer();

test('REQ-007：A.4 平均并发公式必须在渲染层有调用点', () => {
  assert.ok(
    /Calc\.calcAvgConcurrency\s*\(/.test(RENDER),
    'calcAvgConcurrency 未在渲染层调用 —— 第三并发公式对用户不可用'
  );
});

test('REQ-007：推理场景必须提供 n/L/T 三个输入项', () => {
  ['nUsers', 'sessLen', 'period'].forEach((id) => {
    assert.ok(
      new RegExp("id:\\s*'" + id + "'").test(RENDER),
      'SCENE_PARAMS.infer 缺少输入项 ' + id + '，C = n×L/T 无法填参'
    );
  });
});

test('每个 A 级公式函数都在渲染层被调用（防同类缺陷）', () => {
  const required = [
    'calcVRAM', 'calcParams', 'calcTrainData', 'calcTrainFlops',
    'calcConcurrencyH', 'calcConcurrencyTPS', 'calcAvgConcurrency',
    'lookupFinetune', 'applyCompression'
  ];
  const missing = required.filter((fn) => !new RegExp('Calc\\.' + fn + '\\s*\\(').test(RENDER));
  assert.deepStrictEqual(missing, [], '以下 A 级公式未被渲染层调用：' + missing.join(', '));
});

test('C 级估算函数必须落在非标准依据区块（REQ-020）', () => {
  const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const nsStart = HTML.indexOf('id="nonstandard-section"');
  assert.notStrictEqual(nsStart, -1, 'index.html 缺少 #nonstandard-section');
  ['sec-score', 'sec-empirical'].forEach((id) => {
    assert.ok(
      HTML.indexOf('id="' + id + '"') > nsStart,
      id + ' 必须位于 #nonstandard-section 之后，C 级内容不得混入标准结论区'
    );
  });
});

test('MoE 模型必须标注激活参数口径（R6：口径须写明）', () => {
  const DATA = fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8');
  // 只取模型条目（带 id 的行），排除表 A.2 中同为 671B 的档位行（无 id、无需 active_b）
  const moeEntries = DATA.split('\n').filter((l) => /id:\s*'/.test(l) && /params_b:\s*671/.test(l));
  assert.ok(moeEntries.length > 0, '未找到 671B MoE 模型条目');
  moeEntries.forEach((line) => {
    assert.ok(/active_b:/.test(line), 'MoE 条目缺少 active_b：' + line.trim().slice(0, 60));
  });
});
