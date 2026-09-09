/* risk-eval/app.js — 计算层 + 规则层 + 渲染层
 * 分层说明（REQ-020）：
 *   A 级 = GB/Z 201—2026 原文条款（A.1~A.4、表 A.2、表 A.3）
 *   B 级 = 权威框架（OWASP / AI 安全治理框架 2.0 / TC260）
 *   C 级 = 工程经验或自建方法，渲染时统一进入「非标准依据」区块
 * 纯函数集中在 Calc 中，可在 Node 下用 node --test 运行（module.exports 兼容）。
 */
'use strict';

var Calc = (function () {

  /** 安全转数字：非法输入返回 null，避免 NaN 流入渲染层（REQ-015） */
  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = typeof v === 'number' ? v : parseFloat(String(v).trim());
    return (isFinite(n)) ? n : null;
  }

  /** 保留两位小数，避免浮点噪声 */
  function r2(x) { return Math.round(x * 100) / 100; }

  /**
   * 显存估算：M_VM = (P × q / 8) × 1.2   —— GB/Z 201—2026 公式（A.1）
   * @param {number} P 参数规模（B，十亿）
   * @param {number} q 量化位数
   */
  function calcVRAM(P, q) {
    var p = num(P), b = num(q);
    if (p === null || p <= 0) return { ok: false, error: '参数量必须为大于 0 的数字' };
    if (b === null || b <= 0) return { ok: false, error: '量化位数必须为大于 0 的数字' };
    var value = r2(p * b / 8 * 1.2);
    return {
      ok: true, value: value, unit: 'GB', level: 'A', ref: 'A.1',
      formula: 'M = (' + p + ' × ' + b + ' / 8) × 1.2 = ' + value + ' GB'
    };
  }

  /** 参数量估算：N ≈ 12 × L × h²   —— GB/Z 201—2026（A.1） */
  function calcParams(L, h) {
    var l = num(L), hh = num(h);
    if (l === null || l <= 0 || hh === null || hh <= 0) return { ok: false, error: '层数 L 与隐藏维度 h 必须为大于 0 的数字' };
    var n = 12 * l * hh * hh;
    return { ok: true, n: n, nB: r2(n / 1e9), level: 'A', ref: 'A.1', formula: 'N ≈ 12 × ' + l + ' × ' + hh + '² = ' + n.toExponential(3) };
  }

  /** 训练数据量下限：D ≥ 15N   —— GB/Z 201—2026（A.1） */
  function calcTrainData(N) {
    var n = num(N);
    if (n === null || n <= 0) return { ok: false, error: '参数量 N 必须为大于 0 的数字' };
    var d = 15 * n;
    return { ok: true, d: d, level: 'A', ref: 'A.1', formula: 'D ≥ 15 × N = ' + d.toExponential(3) + ' tokens' };
  }

  /** 训练总算力：≈ 6 × N × D   —— GB/Z 201—2026（A.1） */
  function calcTrainFlops(N, D) {
    var n = num(N), d = num(D);
    if (n === null || n <= 0 || d === null || d <= 0) return { ok: false, error: 'N 与 D 必须为大于 0 的数字' };
    var f = 6 * n * d;
    return { ok: true, flops: f, level: 'A', ref: 'A.1', formula: 'FLOPs ≈ 6 × N × D = ' + f.toExponential(3) };
  }

  /** 基础并发量：B = H / I   —— GB/Z 201—2026 公式（A.2） */
  function calcConcurrencyH(H, I) {
    var h = num(H), i = num(I);
    if (h === null || h <= 0) return { ok: false, error: '硬件每秒推理次数 H 必须为大于 0 的数字' };
    if (i === null || i <= 0) return { ok: false, error: '单次推理平均耗时 I 必须为大于 0 的数字' };
    var v = r2(h / i);
    // 注意：B = H / I 是除法；此处曾误写为 h * i，已在单元测试中固化回归
    return { ok: true, value: v, level: 'A', ref: 'A.2', formula: 'B = H / I = ' + h + ' / ' + i + ' = ' + v };
  }

  /** 基础并发量：B = TPS × (TTFT + TPOT × NGT)   —— GB/Z 201—2026 公式（A.3） */
  function calcConcurrencyTPS(TPS, TTFT, TPOT, NGT) {
    var tps = num(TPS), ttft = num(TTFT), tpot = num(TPOT), ngt = num(NGT);
    if (tps === null || tps <= 0) return { ok: false, error: 'TPS 必须为大于 0 的数字' };
    if (ttft === null || ttft < 0) return { ok: false, error: 'TTFT 必须为不小于 0 的数字' };
    if (tpot === null || tpot < 0) return { ok: false, error: 'TPOT 必须为不小于 0 的数字' };
    if (ngt === null || ngt < 0) return { ok: false, error: 'NGT 必须为不小于 0 的数字' };
    var v = r2(tps * (ttft + tpot * ngt));
    return { ok: true, value: v, level: 'A', ref: 'A.3', formula: 'B = ' + tps + ' × (' + ttft + ' + ' + tpot + ' × ' + ngt + ') = ' + v };
  }

  /** 平均并发数：C = n × L / T   —— GB/Z 201—2026 公式（A.4） */
  function calcAvgConcurrency(n, L, T) {
    var a = num(n), l = num(L), t = num(T);
    if (a === null || a <= 0) return { ok: false, error: '活跃用户数 n 必须为大于 0 的数字' };
    if (l === null || l <= 0) return { ok: false, error: '会话平均时长 L 必须为大于 0 的数字' };
    if (t === null || t <= 0) return { ok: false, error: '考察时间段 T 必须为大于 0 的数字' };
    var v = r2(a * l / t);
    return { ok: true, value: v, level: 'A', ref: 'A.4', formula: 'C = ' + a + ' × ' + l + ' / ' + t + ' = ' + v };
  }

  /**
   * 微调配置查表（表 A.2，仅微调场景使用）
   * 非表内档位取相邻档位并标注 approx；超出 1.5B–671B 提示 outOfRange（ADR-004：不做插值）
   */
  function lookupFinetune(P, table) {
    var p = num(P);
    if (p === null || p <= 0) return { ok: false, error: '参数量必须为大于 0 的数字' };
    if (!table || !table.length) return { ok: false, error: '表 A.2 数据缺失' };
    var min = table[0].params_b, max = table[table.length - 1].params_b;
    var outOfRange = (p < min || p > max);
    var exact = null, nearest = table[0], bestDiff = Infinity;
    for (var i = 0; i < table.length; i++) {
      if (table[i].params_b === p) exact = table[i];
      var diff = Math.abs(table[i].params_b - p);
      if (diff < bestDiff) { bestDiff = diff; nearest = table[i]; }
    }
    var tier = exact || nearest;
    return {
      ok: true, level: 'A', ref: '表 A.2',
      vram_g: tier.vram_g, flops: tier.flops, tier: tier.params_b,
      approx: !exact, outOfRange: outOfRange,
      note: outOfRange
        ? '超出表 A.2 覆盖范围（1.5B–671B），此处按最近档位 ' + tier.params_b + 'B 取值，仅供参考'
        : (exact ? '' : '表 A.2 无 ' + p + 'B 档位，按相邻档位 ' + tier.params_b + 'B 取值，非精确值')
    };
  }

  /** 压缩后显存：查表 A.3 压缩率 —— GB/Z 201—2026 表 A.3 */
  function applyCompression(vramGB, ratio) {
    var v = num(vramGB), r = num(ratio);
    if (v === null || v <= 0) return { ok: false, error: '显存值无效' };
    if (r === null || r < 0 || r >= 1) return { ok: false, error: '压缩率无效' };
    var value = r2(v * (1 - r));
    return { ok: true, value: value, level: 'A', ref: '表 A.3', formula: '压缩后 = ' + v + ' × (1 − ' + r + ') = ' + value + ' GB' };
  }

  /**
   * KV Cache 估算 —— 【C 级：工程经验式，GB/Z 附录 A 未给公式】
   * 每 token KV 字节 = 2(K 与 V) × 层数 L × 隐藏维度 h × 每参数字节数
   */
  function estimateKVCache(L, h, seq, batch, bytesPerParam) {
    var l = num(L), hh = num(h), s = num(seq), b = num(batch);
    var bp = num(bytesPerParam) === null ? 2 : num(bytesPerParam);
    if (l === null || l <= 0 || hh === null || hh <= 0) {
      return { ok: false, level: 'C', error: '需填写层数 L 与隐藏维度 h 才能估算 KV Cache' };
    }
    if (s === null || s <= 0 || b === null || b <= 0) {
      return { ok: false, level: 'C', error: '需填写序列长度与批处理大小' };
    }
    var perToken = 2 * l * hh * bp;
    var totalGB = r2(perToken * s * b / Math.pow(1024, 3));
    return {
      ok: true, level: 'C', value: totalGB, unit: 'GB',
      formula: 'KV = 2 × L(' + l + ') × h(' + hh + ') × ' + bp + 'B × seq(' + s + ') × batch(' + b + ') = ' + totalGB + ' GB',
      note: '工程经验式，GB/Z 201—2026 附录 A 未给出 KV Cache 公式'
    };
  }

  /**
   * 硬件匹配 —— 【C 级：工程经验，非标准依据】
   * 依据显存需求给出候选配置档位
   */
  function matchHardware(vramGB) {
    var v = num(vramGB);
    if (v === null || v <= 0) return { ok: false, level: 'C', error: '显存值无效' };
    var text;
    if (v <= 8) text = '单卡 8GB 级（如 RTX 4060/4070）';
    else if (v <= 16) text = '单卡 16GB 级（如 RTX 4080 / A10）';
    else if (v <= 24) text = '单卡 24GB 级（如 RTX 4090 / A10 24G）';
    else if (v <= 48) text = '单卡 48GB 级（如 A6000 / L40S）或 2×24G';
    else if (v <= 80) text = '单卡 80GB 级（如 A100 / H100）或 2×48G';
    else if (v <= 160) text = '2×80GB（A100 / H100）';
    else text = '多机多卡（4×80G 起，需考虑互联带宽与并行策略）';
    return { ok: true, level: 'C', value: text, note: '按显存需求匹配，未计入吞吐与延迟目标；工程经验，非标准依据' };
  }

  return {
    num: num, r2: r2,
    calcVRAM: calcVRAM, calcParams: calcParams, calcTrainData: calcTrainData, calcTrainFlops: calcTrainFlops,
    calcConcurrencyH: calcConcurrencyH, calcConcurrencyTPS: calcConcurrencyTPS, calcAvgConcurrency: calcAvgConcurrency,
    lookupFinetune: lookupFinetune, applyCompression: applyCompression,
    estimateKVCache: estimateKVCache, matchHardware: matchHardware
  };
})();

/* Node 测试兼容导出（浏览器环境无 module，自动跳过，不影响 file:// 运行） */
if (typeof module !== 'undefined' && module.exports) { module.exports = Calc; }

/* ============================ 渲染层（仅浏览器） ============================ */
if (typeof document !== 'undefined') { (function () {

  var D = window.__DATA__;
  var state = { scene: 'infer', model: null, scores: {} };

  var el = function (id) { return document.getElementById(id); };

  /* ---------- 场景参数定义 ---------- */
  var SCENE_PARAMS = {
    infer: [
      { id: 'tps',  label: 'TPS（每秒事务量）', type: 'number' },
      { id: 'ttft', label: 'TTFT 首 Token 时间（s，建议 <1.4）', type: 'number' },
      { id: 'tpot', label: 'TPOT 每 Token 耗时（s）', type: 'number' },
      { id: 'ngt',  label: 'NGT 生成 Token 数', type: 'number' },
      { id: 'H',    label: 'H 硬件每秒推理次数（可选）', type: 'number' },
      { id: 'I',    label: 'I 单次推理平均耗时 s（可选）', type: 'number' },
      { id: 'nUsers', label: 'n 活跃用户数（A.4 平均并发用，可选）', type: 'number' },
      { id: 'sessLen', label: 'L 会话平均时长 s（A.4 用，可选）', type: 'number' },
      { id: 'period', label: 'T 考察时间段 s（A.4 用，可选）', type: 'number' },
      { id: 'L',    label: '层数 L（KV Cache 估算用，可选）', type: 'number' },
      { id: 'h',    label: '隐藏维度 h（KV Cache 估算用，可选）', type: 'number' },
      { id: 'seq',  label: '序列长度（KV Cache 估算用，可选）', type: 'number' },
      { id: 'batch',label: '批处理大小（KV Cache 估算用，可选）', type: 'number' }
    ],
    finetune: [
      { id: 'scheme', label: '压缩方案', type: 'select', options: [
        { v: '', t: '不压缩' },
        { v: 'int8', t: '8-bit 量化（省 50%，损失 <2%）' },
        { v: 'gptq4', t: '4-bit GPTQ（省 75%，损失 <5%）' },
        { v: 'zero', t: 'ZeRO Offload（省 60%~80%，延迟 +20%）' }
      ]},
      { id: 'L', label: '层数 L（可选）', type: 'number' },
      { id: 'h', label: '隐藏维度 h（可选）', type: 'number' }
    ],
    pretrain: [
      { id: 'L', label: '层数 L', type: 'number' },
      { id: 'h', label: '隐藏维度 h', type: 'number' },
      { id: 'dTokens', label: '计划训练数据量 D（tokens，可选，默认按 15N）', type: 'number' }
    ]
  };

  var SCENE_HINT = {
    infer: '推理场景：按 A.1 估算权重显存；表 A.2 为微调配置，不作为推理显存依据。',
    finetune: '微调场景：按表 A.2 取 LoRA 微调最低配置，并按 A.1 估算权重显存。',
    pretrain: '预训练场景：按 A.1 估算参数量 N、数据量下限 D 与总算力 6ND；表 A.2 适用于微调，不适用预训练。'
  };

  /* ---------- 初始化 ---------- */
  function initModels() {
    var sel = el('model-select');
    var opt = document.createElement('option');
    opt.value = ''; opt.textContent = '— 请选择模型 —';
    sel.appendChild(opt);
    D.models.forEach(function (m) {
      var o = document.createElement('option');
      o.value = m.id;
      o.textContent = m.name + '（' + m.vendor + '）' + (m.params_b ? ' · ' + m.params_b + 'B' : ' · 参数未公开');
      sel.appendChild(o);
    });
    sel.addEventListener('change', onModelChange);
    console.info('[risk-eval] 模型库加载完成，共 ' + D.models.length + ' 条，核实日期 ' + D.meta.checked_at);
  }

  function onModelChange() {
    var id = el('model-select').value;
    state.model = D.models.filter(function (m) { return m.id === id; })[0] || null;
    var meta = el('model-meta');
    if (!state.model) { meta.textContent = ''; el('params').value = ''; return; }
    var m = state.model;
    el('params').value = (m.params_b === null ? '' : m.params_b);
    if (m.params_b === null) {
      meta.innerHTML = '<strong>参数量未公开</strong>，请手动填写；来源：' + esc(m.source) + ' · 核实 ' + esc(m.checked_at);
    } else {
      meta.textContent = '厂商 ' + m.vendor + ' · ' + (m.oss ? '开源权重' : '闭源') + ' · ' + m.filing + ' · 来源 ' + m.source + ' · 核实 ' + m.checked_at;
    }
  }

  function renderSceneParams() {
    var box = el('scene-params');
    box.innerHTML = '';
    var list = SCENE_PARAMS[state.scene] || [];
    list.forEach(function (p) {
      var wrap = document.createElement('div');
      wrap.className = 'field';
      var lb = document.createElement('label');
      lb.textContent = p.label;
      lb.setAttribute('for', 'sp-' + p.id);
      wrap.appendChild(lb);
      var input;
      if (p.type === 'select') {
        input = document.createElement('select');
        p.options.forEach(function (o) {
          var oo = document.createElement('option');
          oo.value = o.v; oo.textContent = o.t;
          input.appendChild(oo);
        });
      } else {
        input = document.createElement('input');
        input.type = 'number';
        input.step = 'any';
      }
      input.id = 'sp-' + p.id;
      wrap.appendChild(input);
      box.appendChild(wrap);
    });
    el('scene-hint').textContent = SCENE_HINT[state.scene];
  }

  function bindSceneSwitch() {
    var btns = document.querySelectorAll('.seg-btn');
    Array.prototype.forEach.call(btns, function (b) {
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(btns, function (x) {
          x.classList.remove('is-active');
          x.setAttribute('aria-checked', 'false');
        });
        b.classList.add('is-active');
        b.setAttribute('aria-checked', 'true');
        state.scene = b.getAttribute('data-scene');
        renderSceneParams();
        clearReport();
      });
    });
  }

  function sp(id) {
    var n = el('sp-' + id);
    return n ? n.value : '';
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function clearReport() {
    ['gaps', 'sec-resource', 'sec-data', 'sec-risk', 'sec-compliance', 'sec-score', 'sec-empirical'].forEach(function (k) {
      el(k).innerHTML = '';
    });
  }

  function badge(level) {
    return '<span class="badge badge-' + level.toLowerCase() + '">' + level + '</span>';
  }

  /* ---------- 资源计算 ---------- */
  function computeResources(inp, gaps, standard, empirical, opts) {
    opts = opts || {};
    // 权重显存（A.1）：全场景通用
    var vram = Calc.calcVRAM(inp.params, inp.quant);
    if (vram.ok) {
      // MoE 口径说明：显存按总参数（所有专家需常驻显存），算力按激活参数（R6：口径须写明）
      var moeNote = (state.model && state.model.active_b)
        ? '；MoE 模型：显存按总参数 ' + inp.params + 'B 计（所有专家需常驻显存，路由动态无法预知激活），' +
          '算力/吞吐按激活参数 ' + state.model.active_b + 'B 计'
        : '';
      standard.push(kvRow('模型权重显存（' + inp.quant + ' bit）', vram.value + ' GB', 'A', 'A.1', vram.formula + moeNote));
    } else {
      gaps.push('模型权重显存：' + vram.error);
    }

    // 显存需求基准值：用于硬件匹配（取权重显存，微调场景下若表 A.2 更大则取表 A.2）
    var vramBasis = vram.ok ? vram.value : null;

    if (state.scene === 'finetune' && !opts.skipFinetune) {
      var ft = Calc.lookupFinetune(inp.params, D.tableA2);
      if (ft.ok) {
        standard.push(kvRow('LoRA 微调最低显存', ft.vram_g + ' GB', 'A', '表 A.2',
          '档位 ' + ft.tier + 'B' + (ft.approx ? '（近似档位）' : '') + (ft.note ? '；' + ft.note : '')));
        standard.push(kvRow('LoRA 微调最低算力', ft.flops + ' FLOPs', 'A', '表 A.2', ''));
        if (vramBasis !== null && ft.vram_g > vramBasis) vramBasis = ft.vram_g;
      } else {
        gaps.push('微调配置：' + ft.error);
      }
      var sch = sp('scheme');
      if (sch && vram.ok) {
        var row = D.tableA3.filter(function (x) { return x.id === sch; })[0];
        if (row) {
          var comp = Calc.applyCompression(vram.value, row.ratio);
          if (comp.ok) {
            standard.push(kvRow(row.name + ' 后显存', comp.value + ' GB', 'A', '表 A.3',
              comp.formula + '；' + row.loss + '，适用 ' + row.scene));
          }
        }
      }
    }

    if (state.scene === 'pretrain') {
      var L = sp('L'), h = sp('h');
      var pn = inp.params ? { ok: true, n: inp.params * 1e9, nB: inp.params, formula: '直接采用输入参数量 ' + inp.params + 'B' } : Calc.calcParams(L, h);
      if (pn.ok) {
        standard.push(kvRow('参数量 N', pn.nB + ' B（' + pn.n.toExponential(3) + '）', 'A', 'A.1', pn.formula));
        var dd = Calc.calcTrainData(pn.n);
        if (dd.ok) standard.push(kvRow('训练数据量下限 D', dd.d.toExponential(3) + ' tokens', 'A', 'A.1', dd.formula));
        var dTokens = Calc.num(sp('dTokens'));
        var dUse = (dTokens && dTokens > 0) ? dTokens : (dd.ok ? dd.d : null);
        if (dd.ok) {
          var fl = Calc.calcTrainFlops(pn.n, dUse);
          if (fl.ok) standard.push(kvRow('训练总算力', fl.flops.toExponential(3) + ' FLOPs', 'A', 'A.1', fl.formula + (dTokens ? '（按自定义 D）' : '（按 D=15N）')));
        }
      } else {
        gaps.push('预训练估算：' + pn.error + '（可直接填写参数量）');
      }
    }

    if (state.scene === 'infer') {
      var tps = sp('tps'), ttft = sp('ttft'), tpot = sp('tpot'), ngt = sp('ngt');
      if (tps && ttft && tpot && ngt) {
        var b = Calc.calcConcurrencyTPS(tps, ttft, tpot, ngt);
        if (b.ok) standard.push(kvRow('基础并发量 B（按 A.3）', b.value, 'A', 'A.3', b.formula));
        else gaps.push('并发量：' + b.error);
      }
      var H = sp('H'), I = sp('I');
      if (H && I) {
        var b2 = Calc.calcConcurrencyH(H, I);
        if (b2.ok) standard.push(kvRow('基础并发量 B（按 A.2）', b2.value, 'A', 'A.2', b2.formula));
        else gaps.push('并发量（A.2）：' + b2.error);
      }
      // A.4 平均并发数 C = n × L / T（REQ-007：三公式须均可独立使用）
      var nU = sp('nUsers'), sL = sp('sessLen'), pT = sp('period');
      if (nU && sL && pT) {
        var c = Calc.calcAvgConcurrency(nU, sL, pT);
        if (c.ok) standard.push(kvRow('平均并发数 C（按 A.4）', c.value, 'A', 'A.4', c.formula));
        else gaps.push('平均并发数（A.4）：' + c.error);
      }
      if (!tps && !H && !nU) gaps.push('并发量：未填写 TPS/TTFT/TPOT/NGT、H/I 或 n/L/T 任一组合，无法估算');
    }

    // 硬件匹配（C 级）
    if (vramBasis !== null) {
      var hw = Calc.matchHardware(vramBasis);
      if (hw.ok) empirical.push(kvRow('硬件配置建议（按 ' + vramBasis + ' GB 显存）', hw.value, 'C', '工程经验', hw.note));
    }

    // KV Cache（C 级）
    if (state.scene === 'infer') {
      var L2 = sp('L'), h2 = sp('h'), seq = sp('seq'), batch = sp('batch');
      if (L2 || h2 || seq || batch) {
        var kv = Calc.estimateKVCache(L2, h2, seq, batch, inp.quant / 8);
        if (kv.ok) empirical.push(kvRow('KV Cache 显存（估算）', kv.value + ' GB', 'C', '工程经验', kv.formula + '；' + kv.note));
        else empirical.push(kvRow('KV Cache 显存（估算）', '待填', 'C', '工程经验', kv.error));
      }
    }
  }

  function kvRow(name, value, level, ref, formula) {
    return { name: name, value: value, level: level, ref: ref, formula: formula };
  }

  function renderRows(rows) {
    return rows.map(function (r) {
      return '<div class="risk-item">' +
        '<div class="risk-head"><span class="risk-title">' + esc(r.name) + '</span>' + badge(r.level) +
        (r.ref ? '<span class="risk-src">依据 ' + esc(r.ref) + '</span>' : '') + '</div>' +
        '<div><strong>' + esc(String(r.value)) + '</strong></div>' +
        (r.formula ? '<div class="formula">' + esc(r.formula) + '</div>' : '') +
        '</div>';
    }).join('');
  }

  /* ---------- 数据需求 ---------- */
  function renderDataNeeds(inp, gaps) {
    var out = [];
    out.push('<h3>数据需求</h3>');
    if (inp.params) {
      var n = inp.params * 1e9;
      var dd = Calc.calcTrainData(n);
      if (dd.ok) out.push('<div class="risk-item">' + badge('A') +
        '<div class="risk-head"><span class="risk-title">预训练数据量下限</span><span class="risk-src">依据 A.1</span></div>' +
        '<div>' + dd.d.toExponential(3) + ' tokens</div><div class="formula">' + esc(dd.formula) + '</div></div>');
    } else {
      gaps.push('数据需求量：未填写参数量');
    }
    out.push('<div class="risk-item">' + badge('A') +
      '<div class="risk-head"><span class="risk-title">数据全生命周期要求</span><span class="risk-src">依据 GB/Z 201—2026 第 7 章</span></div>' +
      '<ul>' +
      '<li>数据采集：明确来源与授权，区分公开/内部/核心数据分级</li>' +
      '<li>数据存储与处理：去标识化（GB/T 37964）、个人信息保护（GB/T 35273）</li>' +
      '<li>数据集建设：建立数据偏差检测机制（统计检验、公平性指标），处理样本不均衡</li>' +
      '<li>标注质量：标注一致性校验与抽样复核</li>' +
      '</ul></div>');
    return out.join('');
  }

  /* ---------- 风险与合规 ---------- */
  function renderRisks(inp) {
    var out = ['<h3>安全风险清单</h3>'];
    var list = D.risks.filter(function (r) {
      if (r.when.deploy.indexOf(inp.deploy) === -1) return false;
      if (r.when.agent === true && !inp.agent) return false;
      return true;
    });
    if (!list.length) {
      out.push('<p class="hint">当前组合下无匹配风险项（请检查部署模式）。</p>');
    }
    list.forEach(function (r) {
      out.push('<div class="risk-item level-' + (r.sev === 'high' ? 'high' : r.sev === 'mid' ? 'mid' : 'low') + '">' +
        '<div class="risk-head"><span class="risk-title">' + esc(r.id) + ' ' + esc(r.title) + '</span>' +
        '<span class="level-tag level-' + (r.sev === 'high' ? 'high' : r.sev === 'mid' ? 'mid' : 'low') + '">' +
        (r.sev === 'high' ? '高' : r.sev === 'mid' ? '中' : '低') + '</span>' +
        badge(r.level) + '<span class="risk-src">' + esc(r.src) + '</span></div>' +
        '<p style="margin:8px 0 0">' + esc(r.desc) + '</p>' +
        '<ul>' + r.mitigations.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' +
        '</div>');
    });
    return out.join('');
  }

  function renderCompliance(inp) {
    var out = ['<h3>合规提示</h3>'];
    var m = state.model;
    var blocking = (m && m.overseas && inp.sensitivity === 'core');
    if (blocking) {
      out.push('<div class="alert"><strong>阻断式提示：</strong>所选模型为境外服务，且数据敏感度为核心/涉密。' +
        '核心数据不得出境，须改用境内私有化部署的开源权重模型。</div>');
    }
    D.compliance.forEach(function (c) {
      var show = false;
      if (c.applies.always) show = true;
      if (c.applies.overseas && m && m.overseas) show = true;
      if (c.applies.public_service && inp.deploy === 'maas') show = true;
      if (!show) return;
      out.push('<div class="risk-item">' + badge(c.level) +
        '<div class="risk-head"><span class="risk-title">' + esc(c.title) + '</span>' +
        '<span class="risk-src">' + esc(c.src) + '</span></div>' +
        '<p style="margin:8px 0 0">' + esc(c.desc) + '</p></div>');
    });
    if (m && m.oss === false) {
      out.push('<div class="alert alert-warn">闭源 API 模型无法验证权重与训练流程，投毒/后门风险只能靠行为抽测、供应商信誉与合同约束；通常也不支持微调。</div>');
    }
    return out.join('');
  }

  /* ---------- 评分（C 级） ---------- */
  function renderScore(inp) {
    var out = ['<h3>7 维加权评分</h3>',
      '<p class="hint">权重来源：本地《大模型选型实操指南》，<strong>自建，非标准原文</strong>。未评分维度不计入总分（不默认给分）。</p>'];
    out.push('<div class="field"><label for="preset">权重预设</label><select id="preset">' +
      Object.keys(D.weightsPresets).map(function (k) {
        return '<option value="' + k + '">' + D.weightsPresets[k].label + '</option>';
      }).join('') + '</select></div>');
    Object.keys(D.dimLabels).forEach(function (k) {
      out.push('<div class="score-row"><label for="sc-' + k + '">' + D.dimLabels[k] + '</label>' +
        '<input type="range" id="sc-' + k + '" min="1" max="5" step="1" value="0" data-dim="' + k + '">' +
        '<span class="score-val" id="scv-' + k + '">未评分</span></div>');
    });
    out.push('<div id="score-result" style="margin-top:16px"></div>');
    return out.join('');
  }

  function bindScore() {
    var preset = el('preset');
    if (!preset) return;
    var sliders = document.querySelectorAll('input[type="range"][data-dim]');
    function recalc() {
      // 防御：预设值缺省或失效时回落到「通用」权重，避免 undefined 崩溃（R16）
      var presetCfg = D.weightsPresets[preset.value] || D.weightsPresets.general;
      var w = presetCfg.weights;
      var sum = 0, wsum = 0, missing = [];
      Array.prototype.forEach.call(sliders, function (s) {
        var dim = s.getAttribute('data-dim');
        var v = parseInt(s.value, 10);
        el('scv-' + dim).textContent = (v >= 1 ? v + ' 分' : '未评分');
        if (v >= 1) { sum += v * w[dim]; wsum += w[dim]; }
        else missing.push(D.dimLabels[dim]);
      });
      var box = el('score-result');
      if (wsum === 0) {
        box.innerHTML = '<p class="hint">尚未评分，拖动滑块开始评分。</p>';
      } else {
        var score = Math.round(sum / wsum * 100) / 100;
        // 反方陈述加固：总分是「主观评分 × 自建权重」，保留两位小数会传递虚假精度，
        // 必须紧跟不可比/不可验收警示，否则用户会拿它跨模型比大小或当验收依据
        box.innerHTML = '<div class="risk-item"><div class="risk-head"><span class="risk-title">加权总分</span>' + badge('C') +
          '</div><div><strong>' + score + ' / 5</strong>（已评维度权重合计 ' + wsum + '%）</div>' +
          '<p class="hint" style="margin:8px 0 0;color:var(--danger)">' +
          '<strong>不可跨模型比较、不可作为验收依据。</strong>' +
          '分子为你的主观评分，分母为已评维度权重合计——两个模型若评分维度不同，分数无可比性；' +
          '权重取自本地自建文档，非标准原文。</p>' +
          (missing.length ? '<p style="margin:8px 0 0">未评分维度：' + esc(missing.join('、')) + '</p>' : '') + '</div>';
      }
    }
    preset.addEventListener('change', recalc);
    Array.prototype.forEach.call(sliders, function (s) { s.addEventListener('input', recalc); });
    recalc();
  }

  /* ---------- 主流程 ---------- */
  function generate() {
    clearReport();
    var err = el('form-error');
    err.textContent = '';
    var inp = {
      params: Calc.num(el('params').value),
      quant: parseInt(el('quant').value, 10),
      deploy: document.querySelector('input[name="deploy"]:checked').value,
      sensitivity: el('sensitivity').value,
      agent: el('agent-toggle').checked
    };
    // 预训练场景允许只填 L/h 由架构推算 N（PRD REQ-006），其余场景必须给参数量
    var archL = Calc.num(sp('L')), archH = Calc.num(sp('h'));
    var canDeriveFromArch = (state.scene === 'pretrain' && archL && archH);
    if (inp.params === null && !canDeriveFromArch) {
      err.textContent = '请填写参数量（模型库未公开参数时请手动填写；预训练场景也可填写层数 L 与隐藏维度 h）。';
      el('params').classList.add('is-invalid');
      return;
    }
    el('params').classList.remove('is-invalid');

    var gaps = [], standard = [], empirical = [];

    // 闭源 + 微调场景：判定不适用（契约 Edge）
    // 修正：此前整段替换为告警，连与微调无关的 A.1 权重显存也一并吞掉（R19：决定须可看出）
    if (state.scene === 'finetune' && state.model && state.model.oss === false) {
      computeResources(inp, gaps, standard, empirical, { skipFinetune: true });
      el('sec-resource').innerHTML = '<h3>资源需求</h3>' +
        '<div class="alert alert-warn">所选模型为闭源 API，通常不支持微调，' +
        '<strong>表 A.2 微调配置不适用，已省略</strong>；以下保留与微调无关的 A.1 权重显存项。</div>' +
        (standard.length ? renderRows(standard) : '<p class="hint">无可输出的标准依据项。</p>');
    } else {
      computeResources(inp, gaps, standard, empirical);
      el('sec-resource').innerHTML = '<h3>资源需求</h3>' + (standard.length ? renderRows(standard) : '<p class="hint">无可输出的标准依据项。</p>');
    }

    el('sec-data').innerHTML = renderDataNeeds(inp, gaps);
    el('sec-risk').innerHTML = renderRisks(inp);
    el('sec-compliance').innerHTML = renderCompliance(inp);
    el('sec-score').innerHTML = renderScore(inp);
    bindScore();
    el('sec-empirical').innerHTML = empirical.length ? '<h3>其它经验估算</h3>' + renderRows(empirical) : '';

    el('gaps').innerHTML = gaps.length
      ? '<div class="gaps"><strong>' + gaps.length + ' 项待填/待确认</strong><ul>' +
        gaps.map(function (g) { return '<li>' + esc(g) + '</li>'; }).join('') + '</ul></div>'
      : '';

    /* 诊断日志：让用户在控制台一眼看到每个区块渲染了多少节点（防 print CSS 误伤其余区） */
    console.info('[risk-eval] 报告已生成：resource=' + standard.length +
      ' data=1 risk=' + (el('sec-risk').innerHTML.match(/risk-item/g) || []).length +
      ' compliance=' + (el('sec-compliance').innerHTML.match(/risk-item/g) || []).length +
      ' score=1 gaps=' + gaps.length +
      ' empirical=' + empirical.length);
  }

  function bind() {
    bindSceneSwitch();
    el('manual-toggle').addEventListener('change', function () {
      var manual = this.checked;
      el('model-select').disabled = manual;
      el('params').disabled = !manual && !!(state.model && state.model.params_b);
      if (manual) { el('params').disabled = false; el('model-meta').textContent = '手动模式：请自行填写参数量等信息。'; }
      else onModelChange();
    });
    el('btn-generate').addEventListener('click', generate);
    el('btn-reset').addEventListener('click', function () {
      el('params').value = ''; el('model-select').value = ''; clearReport(); el('form-error').textContent = '';
    });
    el('btn-print').addEventListener('click', function () { window.print(); });
  }

  try {
    initModels();
    bind();
    renderSceneParams();
  } catch (e) {
    // 初始化失败必须在页面上可见，不允许静默失败（R16）
    console.error('[risk-eval] 初始化失败：', e);
    var box = document.getElementById('form-error');
    if (box) box.textContent = '页面初始化失败：' + e.message;
  }

})(); }
