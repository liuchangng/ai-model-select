/* risk-eval/data.js — 数据层
 * 以 window.__DATA__ 挂载（ADR-001：file:// 下 fetch JSON 会被 CORS 拦截，<script> 不受限）
 *
 * 数据分级约定（REQ-020）：
 *   level 'A' = GB/Z 201—2026 原文条款/表格
 *   level 'B' = 权威框架（OWASP / AI 安全治理框架 2.0 / TC260）
 *   level 'C' = 自建或工程经验
 *
 * 反杜撰约定：模型条目参数量取自公开模型卡/官方公告；未公开者一律置 null，
 *   由页面提示手动填写，绝不臆测。checked_at 为本地核实日期。
 */

window.__DATA__ = {

  meta: {
    standard: 'GB/Z 201—2026《人工智能 大模型选型和应用指南》',
    standard_note: '附录 A 为资料性附录，本页结果为量级估算，非承诺值',
    checked_at: '2026-09-09',
    quant_options: [16, 8, 4]
  },

  /* ---------- 表 A.2：大模型参数规模对应 LoRA 微调训练配置（PDF p17-18 原文） ---------- */
  tableA2: [
    { params_b: 1.5, vram_g: 3,    flops: '3.5×10^13' },
    { params_b: 7,   vram_g: 13,   flops: '1.7×10^14' },
    { params_b: 8,   vram_g: 15,   flops: '2×10^14'   },
    { params_b: 14,  vram_g: 26,   flops: '3.5×10^14' },
    { params_b: 32,  vram_g: 48,   flops: '8×10^14'   },
    { params_b: 70,  vram_g: 130,  flops: '1.7×10^15' },
    { params_b: 671, vram_g: 1250, flops: '1.7×10^16' }
  ],

  /* ---------- 表 A.3：优化技术降低硬件门槛（PDF p19 原文） ---------- */
  tableA3: [
    { id: 'int8',  name: '8-bit 量化',   ratio: 0.50, loss: '性能损失 < 2%',    scene: '企业级推理（如客服系统）' },
    { id: 'gptq4', name: '4-bit GPTQ',   ratio: 0.75, loss: '性能损失 < 5%',    scene: '边缘设备（如手机端大模型）' },
    { id: 'zero',  name: 'ZeRO Offload', ratio: 0.70, loss: '延迟增加 20%',     scene: '低成本微调（单卡训练 70B）', ratioText: '60%~80%' }
  ],

  /* ---------- 模型库（含国际模型；参数量未公开者置 null） ---------- */
  models: [
    { id: 'qwen2.5-7b',  name: 'Qwen2.5-7B',   vendor: '阿里云',  params_b: 7,    oss: true,  overseas: false, ctx_k: 128, multimodal: false, filing: '已备案', source: '官方模型卡', checked_at: '2026-09-09' },
    { id: 'qwen2.5-72b', name: 'Qwen2.5-72B',  vendor: '阿里云',  params_b: 72,   oss: true,  overseas: false, ctx_k: 128, multimodal: false, filing: '已备案', source: '官方模型卡', checked_at: '2026-09-09' },
    { id: 'qwen3-8b',    name: 'Qwen3-8B',     vendor: '阿里云',  params_b: 8,    oss: true,  overseas: false, ctx_k: 32,  multimodal: false, filing: '已备案', source: '官方模型卡', checked_at: '2026-09-09' },
    { id: 'qwen3-32b',   name: 'Qwen3-32B',    vendor: '阿里云',  params_b: 32,   oss: true,  overseas: false, ctx_k: 32,  multimodal: false, filing: '已备案', source: '官方模型卡', checked_at: '2026-09-09' },
    { id: 'deepseek-v3', name: 'DeepSeek-V3',  vendor: '深度求索', params_b: 671,  oss: true,  overseas: false, ctx_k: 128, multimodal: false, filing: '已备案', source: '官方技术报告（MoE 总参数 671B，激活约 37B）', checked_at: '2026-09-09' },
    { id: 'deepseek-r1', name: 'DeepSeek-R1',  vendor: '深度求索', params_b: 671,  oss: true,  overseas: false, ctx_k: 128, multimodal: false, filing: '已备案', source: '官方技术报告（MoE 总参数 671B）', checked_at: '2026-09-09' },
    { id: 'glm-4-9b',    name: 'GLM-4-9B',     vendor: '智谱 AI',  params_b: 9,    oss: true,  overseas: false, ctx_k: 128, multimodal: false, filing: '已备案', source: '官方模型卡', checked_at: '2026-09-09' },
    { id: 'ernie-4.5',   name: '文心 4.5',      vendor: '百度',    params_b: null, oss: false, overseas: false, ctx_k: null, multimodal: true,  filing: '已备案', source: '参数量未公开，需手动填写', checked_at: '2026-09-09' },
    { id: 'doubao',      name: '豆包',          vendor: '字节跳动', params_b: null, oss: false, overseas: false, ctx_k: null, multimodal: true,  filing: '已备案', source: '参数量未公开，需手动填写', checked_at: '2026-09-09' },
    { id: 'hunyuan',     name: '混元',          vendor: '腾讯',    params_b: null, oss: false, overseas: false, ctx_k: null, multimodal: true,  filing: '已备案', source: '参数量未公开，需手动填写', checked_at: '2026-09-09' },
    { id: 'kimi',        name: 'Kimi',          vendor: '月之暗面', params_b: null, oss: false, overseas: false, ctx_k: null, multimodal: false, filing: '已备案', source: '参数量未公开，需手动填写', checked_at: '2026-09-09' },

    { id: 'llama-3.1-8b',  name: 'Llama 3.1 8B',  vendor: 'Meta',      params_b: 8,    oss: true,  overseas: true, ctx_k: 128, multimodal: false, filing: '境外服务', source: '官方模型卡', checked_at: '2026-09-09' },
    { id: 'llama-3.1-70b', name: 'Llama 3.1 70B', vendor: 'Meta',      params_b: 70,   oss: true,  overseas: true, ctx_k: 128, multimodal: false, filing: '境外服务', source: '官方模型卡', checked_at: '2026-09-09' },
    { id: 'llama-3.1-405b',name: 'Llama 3.1 405B',vendor: 'Meta',      params_b: 405,  oss: true,  overseas: true, ctx_k: 128, multimodal: false, filing: '境外服务', source: '官方模型卡', checked_at: '2026-09-09' },
    { id: 'mistral-7b',    name: 'Mistral 7B',    vendor: 'Mistral AI', params_b: 7,    oss: true,  overseas: true, ctx_k: 32,  multimodal: false, filing: '境外服务', source: '官方模型卡', checked_at: '2026-09-09' },
    { id: 'mixtral-8x7b',  name: 'Mixtral 8x7B',  vendor: 'Mistral AI', params_b: 46.7, oss: true,  overseas: true, ctx_k: 32,  multimodal: false, filing: '境外服务', source: '官方模型卡（总参数约 46.7B）', checked_at: '2026-09-09' },
    { id: 'gemma-2-27b',   name: 'Gemma 2 27B',   vendor: 'Google',    params_b: 27,   oss: true,  overseas: true, ctx_k: 8,   multimodal: false, filing: '境外服务', source: '官方模型卡', checked_at: '2026-09-09' },
    { id: 'gpt-4o',        name: 'GPT-4o',        vendor: 'OpenAI',    params_b: null, oss: false, overseas: true, ctx_k: 128, multimodal: true,  filing: '境外服务', source: '参数量未公开，需手动填写', checked_at: '2026-09-09' },
    { id: 'claude',        name: 'Claude',        vendor: 'Anthropic', params_b: null, oss: false, overseas: true, ctx_k: 200, multimodal: true,  filing: '境外服务', source: '参数量未公开，需手动填写', checked_at: '2026-09-09' },
    { id: 'gemini',        name: 'Gemini',        vendor: 'Google',    params_b: null, oss: false, overseas: true, ctx_k: null, multimodal: true,  filing: '境外服务', source: '参数量未公开，需手动填写', checked_at: '2026-09-09' }
  ],

  /* ---------- 风险清单（来源：OWASP LLM Top10 2026 / Agentic 2026 / 框架 2.0） ---------- */
  risks: [
    { id: 'LLM01', level: 'B', title: '提示词注入', src: 'OWASP LLM Top10 2026',
      desc: '通过输入改变模型行为，含间接注入（网页/文档/邮件中藏指令）、多模态注入、隐形 Unicode 注入。LLM 无法区分指令与数据，属架构性缺陷，无根治手段。',
      sev: 'high', when: { deploy: ['maas', 'private', 'cluster', 'edge'], agent: null },
      mitigations: ['按信任级别隔离内容：系统指令/用户输入/外部内容分通道，外部内容不当指令执行', '高危操作加意图门：涉及资金、删除、权限变更须二次确认', '定期红队对抗测试（promptfoo、garak 等）'] },

    { id: 'LLM02', level: 'B', title: '敏感信息泄露', src: 'OWASP LLM Top10 2026',
      desc: '答案文本、工具调用参数、日志、嵌入向量、时序/长度侧信道均可能泄露；训练数据抽取与成员推理亦属此列。',
      sev: 'high', when: { deploy: ['maas', 'private', 'cluster'], agent: null },
      mitigations: ['审查厂商训练数据卫生（PII 清洗、差分隐私）', '日志与推理轨迹按敏感数据管理', '私有化部署按密钥资产级别管理权重'] },

    { id: 'LLM03', level: 'B', title: '过度代理', src: 'OWASP LLM Top10 2026',
      desc: '功能过多、权限过大、自主性过高三者叠加，把"说错话"放大成"办错事"。2026 版由第 6 升至第 3。',
      sev: 'high', when: { deploy: ['private', 'cluster'], agent: true },
      mitigations: ['最小代理权：自主性是挣得的权限，不是默认配置', '智能体使用独立身份与任务级短时令牌', '高影响动作人机协同审批 + 一键吊销'] },

    { id: 'LLM04', level: 'B', title: '供应链', src: 'OWASP LLM Top10 2026',
      desc: '预训练权重、数据集、LoRA 适配器、量化工具、推理框架都是攻击面；Pickle 反序列化加载即执行任意代码；第三方微调产物即"后门"的成品形态。',
      sev: 'high', when: { deploy: ['private', 'cluster', 'edge'], agent: null },
      mitigations: ['官方渠道获取权重并校验哈希/签名', '推理框架钉版本并订阅 CVE', '第三方 LoRA 只取可信来源，SBOM 化管理'] },

    { id: 'LLM05', level: 'B', title: '数据与模型投毒', src: 'OWASP LLM Top10 2026',
      desc: '预训练语料投毒、微调阶段立场注入、RAG 检索内容投毒均为路径；后门可长期潜伏。',
      sev: 'high', when: { deploy: ['maas', 'private', 'cluster'], agent: null },
      mitigations: ['领域事实抽测 50 题以上，观察错误是否系统性集中', '交叉验证 2~3 家模型 + 传统检索，分歧处重点排查', '闭源模型只能靠行为抽测 + 合同约束'] },

    { id: 'LLM06', level: 'B', title: '无限制消耗（拒绝钱包）', src: 'OWASP LLM Top10 2026',
      desc: '极低成本触发极高成本计算；放大器包括长输出推理模型、多模态大图、智能体扇出。限流挡不住，因为一次请求 ≠ 一份成本。',
      sev: 'mid', when: { deploy: ['maas', 'cluster'], agent: null },
      mitigations: ['按 token/按任务设预算上限与告警', '单会话成本熔断', '限制智能体调用深度与扇出'] },

    { id: 'LLM07', level: 'B', title: '虚假信息（幻觉）', src: 'OWASP LLM Top10 2026',
      desc: '2026 版因事故数据权重上升 2 位；输出驱动自动化流程且无人复核时危害放大。',
      sev: 'mid', when: { deploy: ['maas', 'private', 'cluster', 'edge'], agent: null },
      mitigations: ['关键结论强制引用来源并人工复核', 'RAG 提供可核查依据', '输出驱动自动化时设置复核环节'] },

    { id: 'LLM08', level: 'B', title: '隐蔽上下文暴露', src: 'OWASP LLM Top10 2026',
      desc: '系统提示词、工具定义、检索块、记忆都可能被套出；提示词里藏 API key 等于递上越狱说明书。',
      sev: 'mid', when: { deploy: ['maas', 'private', 'cluster'], agent: null },
      mitigations: ['凭证绝不进提示词，放密钥管理系统', '按"系统提示词终将泄露"来设计', '防护靠外部护栏，不靠提示词保密'] },

    { id: 'LLM09', level: 'B', title: '向量与嵌入弱点（RAG）', src: 'OWASP LLM Top10 2026',
      desc: '嵌入反演可还原原文；向量库投毒可间接注入；跨租户检索可越权读取他人数据。',
      sev: 'mid', when: { deploy: ['private', 'cluster'], agent: null },
      mitigations: ['按源文档权限过滤后再检索', '嵌入数据分级与完整性校验', 'RAG 数据源纳入数据治理'] },

    { id: 'LLM10', level: 'B', title: '不安全的输出处理', src: 'OWASP LLM Top10 2026',
      desc: '模型输出未消毒直接进下游系统，导致 XSS / SQL 注入 / 命令注入。',
      sev: 'high', when: { deploy: ['private', 'cluster', 'edge'], agent: null },
      mitigations: ['把模型输出当不可信用户输入', '参数化查询 + 上下文感知编码 + 输出白名单', '最小权限运行时'] },

    { id: 'ASI01', level: 'B', title: '目标劫持', src: 'OWASP Agentic Top10 2026',
      desc: '攻击者通过注入或环境操纵改变智能体目标，使其持续执行非预期任务。',
      sev: 'high', when: { deploy: ['private', 'cluster'], agent: true },
      mitigations: ['目标与约束外置且不可被模型改写', '关键节点人工确认', '行为基线监测'] },
    { id: 'ASI02', level: 'B', title: '工具滥用', src: 'OWASP Agentic Top10 2026',
      desc: '智能体调用合法工具做非法用途（如读取工具被用于外传数据）。',
      sev: 'high', when: { deploy: ['private', 'cluster'], agent: true },
      mitigations: ['工具最小权限与参数白名单', '敏感工具调用留痕与审计'] },
    { id: 'ASI03', level: 'B', title: '身份与权限滥用', src: 'OWASP Agentic Top10 2026',
      desc: '智能体复用用户会话或长期凭证，导致权限扩散。',
      sev: 'high', when: { deploy: ['private', 'cluster'], agent: true },
      mitigations: ['独立身份（NHI）与任务级短时令牌', '权限随任务结束自动回收'] },
    { id: 'ASI04', level: 'B', title: '智能体供应链', src: 'OWASP Agentic Top10 2026',
      desc: '第三方工具、插件、MCP 服务成为新的攻击面。',
      sev: 'mid', when: { deploy: ['private', 'cluster'], agent: true },
      mitigations: ['工具来源白名单与签名校验', '禁用未审计插件'] },
    { id: 'ASI05', level: 'B', title: '意外代码执行（RCE）', src: 'OWASP Agentic Top10 2026',
      desc: '智能体生成并执行代码，沙箱逃逸可导致主机失陷。',
      sev: 'high', when: { deploy: ['private', 'cluster'], agent: true },
      mitigations: ['代码执行强制沙箱且无外网', '资源与时长上限'] },
    { id: 'ASI06', level: 'B', title: '记忆与上下文投毒', src: 'OWASP Agentic Top10 2026',
      desc: '长期记忆被污染后持续影响后续决策，污染难以发现。',
      sev: 'mid', when: { deploy: ['private', 'cluster'], agent: true },
      mitigations: ['记忆分区与写入审计', '定期清理与回滚能力'] },
    { id: 'ASI07', level: 'B', title: '智能体间通信不安全', src: 'OWASP Agentic Top10 2026',
      desc: '多智能体之间消息未认证/未加密，可被伪造或窃听。',
      sev: 'mid', when: { deploy: ['private', 'cluster'], agent: true },
      mitigations: ['消息签名与身份认证', '最小信任域划分'] },
    { id: 'ASI08', level: 'B', title: '级联失败', src: 'OWASP Agentic Top10 2026',
      desc: '单点错误在多智能体链路中放大，造成系统性故障。',
      sev: 'mid', when: { deploy: ['private', 'cluster'], agent: true },
      mitigations: ['设置熔断与降级路径', '限制链路深度与扇出'] },
    { id: 'ASI09', level: 'B', title: '拟人信任滥用', src: 'OWASP Agentic Top10 2026',
      desc: '拟人化外表诱导用户执行不安全操作。',
      sev: 'mid', when: { deploy: ['maas', 'private', 'cluster'], agent: true },
      mitigations: ['显著标识 AI 身份', '敏感操作二次确认'] },
    { id: 'ASI10', level: 'B', title: '流氓智能体', src: 'OWASP Agentic Top10 2026',
      desc: '智能体行为漂移脱离预期，持续造成危害而不被发现。',
      sev: 'high', when: { deploy: ['private', 'cluster'], agent: true },
      mitigations: ['行为基线监测，漂移即杀', '一键吊销凭证'] },

    { id: 'F2-TECH', level: 'B', title: '技术内生风险', src: '《AI 安全治理框架》2.0',
      desc: '模型算法本身、训练数据、系统与网络层面的风险（含偏见歧视、训练数据内容偏差、系统安全漏洞）。',
      sev: 'mid', when: { deploy: ['maas', 'private', 'cluster', 'edge'], agent: null },
      mitigations: ['训练/推理环境隔离', '可信执行环境（SGX / TrustZone）', '容器与 K8s 漏洞治理'] },
    { id: 'F2-APPLY', level: 'B', title: '技术应用风险', src: '《AI 安全治理框架》2.0',
      desc: '应用方式不当带来的风险（如将模型输出直接用于自动化决策而无人复核）。',
      sev: 'mid', when: { deploy: ['maas', 'private', 'cluster'], agent: null },
      mitigations: ['按场景分级管理，低依赖场景降档使用', '关键决策保留人工环节'] },
    { id: 'F2-DERIVE', level: 'B', title: '应用衍生风险', src: '《AI 安全治理框架》2.0',
      desc: '深伪诈骗、冒充客服/领导、拟人化信任滥用等社会面衍生风险。',
      sev: 'mid', when: { deploy: ['maas', 'private', 'cluster'], agent: null },
      mitigations: ['对外合成内容加显式/隐式标识', '身份核验不依赖"看得见真人"', '员工培训：AI 输出默认待验证'] }
  ],

  /* ---------- 合规基线 ---------- */
  compliance: [
    { id: 'filing', level: 'B', title: '生成式 AI 服务备案', src: '《生成式人工智能服务管理暂行办法》',
      desc: '面向公众提供服务须完成备案与安全评估。', applies: { public_service: true } },
    { id: 'tc260', level: 'B', title: 'TC260 安全基本要求', src: 'TC260《生成式人工智能服务安全基本要求》',
      desc: '语料安全（违法不良信息占比 >5% 整批禁用）、模型安全、安全措施、评估方法；是备案实测依据。', applies: { always: true } },
    { id: 'label', level: 'B', title: '生成合成内容标识', src: '《人工智能生成合成内容标识办法》（2025-09-01 施行）',
      desc: '生成内容须带显式标识与隐式元数据标识。', applies: { always: true } },
    { id: 'export', level: 'B', title: '数据出境评估', src: '《数据出境安全评估办法》',
      desc: '向境外提供数据可能触发安全评估；核心/涉密数据不得出境。', applies: { overseas: true } },
    { id: 'pi', level: 'B', title: '个人信息与去标识化', src: 'GB/T 35273 / GB/T 37964（GB/Z 201—2026 已引用）',
      desc: '数据采集、存储、处理、数据集建设全链路需去标识化与个人信息保护。', applies: { always: true } }
  ],

  /* ---------- 7 维评分权重预设（来源：本地《大模型选型实操指南》，自建，非标准原文 → C 级） ---------- */
  weightsPresets: {
    general: { label: '通用', weights: { accuracy: 25, fairness: 15, poisoning: 15, usability: 10, compliance: 15, cost: 10, ecosystem: 10 } },
    secret:  { label: '涉密场景', weights: { accuracy: 20, fairness: 10, poisoning: 15, usability: 5,  compliance: 30, cost: 10, ecosystem: 10 } },
    public:  { label: '面向公众', weights: { accuracy: 20, fairness: 25, poisoning: 15, usability: 10, compliance: 15, cost: 5,  ecosystem: 10 } }
  },

  dimLabels: {
    accuracy: '业务任务准确率',
    fairness: '公平性',
    poisoning: '抗投毒/事实一致性',
    usability: '回答可用性（对齐损耗）',
    compliance: '数据合规',
    cost: '成本',
    ecosystem: '生态与续命能力'
  }
};
