import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "lib/data/question_bank_320.json");
const outputPath = path.join(root, "lib/data/question_bank_640.json");
const catalogPath = path.join(root, "lib/data/trait_catalog_32.json");
const mappingPath = path.join(root, "lib/data/question_id_map_v2_to_v3.json");
const VERSION = "3.0.0";

const traits = [
  { id: "life_social_initiative", name: "社交主动度", axis: "EI", domain: "life", pole: "E", sourceFacets: ["recovery_space", "interaction_energy"], behavior: "在需要建立连接时主动开口、邀请互动", alternative: "先观察环境，再决定是否加入互动", action: "重要场合先准备一句自然的开场白" },
  { id: "life_solitude_recovery", name: "独处恢复力", axis: "EI", domain: "life", pole: "I", sourceFacets: ["recovery_space", "interaction_energy"], behavior: "通过安静、独立空间恢复精力", alternative: "通过交流和共同活动重新获得能量", action: "提前为高强度社交后的独处留出时间" },
  { id: "life_instant_expression", name: "即时表达度", axis: "EI", domain: "life", pole: "E", sourceFacets: ["expression_processing", "initiative_visibility"], behavior: "边表达边整理想法，让外部反馈推动思考", alternative: "想清楚后再表达，避免过早暴露未成形判断", action: "表达前先用一句话标记这只是初步想法" },
  { id: "life_independent_thinking", name: "独立思考度", axis: "EI", domain: "life", pole: "I", sourceFacets: ["expression_processing", "initiative_visibility"], behavior: "先在内部形成判断，再选择合适时机表达", alternative: "在讨论中逐步澄清自己的想法", action: "还没想完时先同步进度，减少他人等待的不确定" },

  { id: "life_detail_attention", name: "细节关注度", axis: "SN", domain: "life", pole: "S", sourceFacets: ["fact_detail", "communication_memory"], behavior: "优先留意事实、步骤、数字和可核对细节", alternative: "先抓整体意义，再按需要补充细节", action: "重要决定前列出三个必须核对的事实" },
  { id: "life_pattern_insight", name: "模式洞察力", axis: "SN", domain: "life", pole: "N", sourceFacets: ["fact_detail", "communication_memory"], behavior: "从分散信息中寻找联系、趋势和隐含意义", alternative: "依靠直接经验和具体证据理解事情", action: "形成推测后补问一个可以验证它的事实" },
  { id: "life_practical_grounding", name: "现实落地度", axis: "SN", domain: "life", pole: "S", sourceFacets: ["pattern_possibility", "practical_experiment"], behavior: "把想法拆成能马上尝试的步骤", alternative: "先探索更多方向，暂不急于固定做法", action: "把一个想法转成今天可以完成的最小动作" },
  { id: "life_possibility_exploration", name: "可能性探索度", axis: "SN", domain: "life", pole: "N", sourceFacets: ["pattern_possibility", "practical_experiment"], behavior: "看到现状之外的替代方案和发展可能", alternative: "优先选择已经验证、可以稳定执行的方法", action: "探索新方向时同时保留一个可落地的备选" },

  { id: "life_logic_analysis", name: "逻辑分析度", axis: "TF", domain: "life", pole: "T", sourceFacets: ["logic_consistency", "conflict_feedback"], behavior: "用因果、标准和一致性判断问题", alternative: "先感受相关人的状态与关系影响", action: "给出结论时补充一句它可能带来的感受" },
  { id: "life_emotion_awareness", name: "情绪感知度", axis: "TF", domain: "life", pole: "F", sourceFacets: ["logic_consistency", "conflict_feedback"], behavior: "迅速注意到情绪变化和他人的体验", alternative: "先处理问题本身，再回应情绪", action: "感受到情绪后再确认一次，不替对方下结论" },
  { id: "life_principle_judgment", name: "原则判断度", axis: "TF", domain: "life", pole: "T", sourceFacets: ["fairness_support", "empathy_attunement"], behavior: "依据清晰规则和可重复标准做决定", alternative: "根据具体处境调整判断，照顾个体差异", action: "坚持原则时说明适用边界和例外条件" },
  { id: "life_relationship_consideration", name: "关系顾及度", axis: "TF", domain: "life", pole: "F", sourceFacets: ["fairness_support", "empathy_attunement"], behavior: "把决定对他人和关系的影响纳入判断", alternative: "优先保证标准一致，不让情绪改变结论", action: "照顾关系时也明确说出自己的底线" },

  { id: "life_planning_organization", name: "计划组织度", axis: "JP", domain: "life", pole: "J", sourceFacets: ["planning_structure", "routine_deadline"], behavior: "提前安排顺序、时间和所需资源", alternative: "根据现场信息灵活决定下一步", action: "只规划关键节点，为变化保留缓冲" },
  { id: "life_free_exploration", name: "自由探索度", axis: "JP", domain: "life", pole: "P", sourceFacets: ["planning_structure", "routine_deadline"], behavior: "保留开放空间，边行动边发现更合适的方向", alternative: "先建立清晰结构，再按计划推进", action: "为开放任务设置一个最低限度的检查时间" },
  { id: "life_result_closure", name: "结果闭环度", axis: "JP", domain: "life", pole: "J", sourceFacets: ["closure_decision", "adaptability_change"], behavior: "倾向尽快完成决定并把事情收尾", alternative: "在更多信息出现前保持选择开放", action: "收尾前问一次是否还有关键事实没有看到" },
  { id: "life_adaptive_flexibility", name: "灵活应变度", axis: "JP", domain: "life", pole: "P", sourceFacets: ["closure_decision", "adaptability_change"], behavior: "计划变化时快速调整，不执着原定路径", alternative: "通过维持原计划和确定节奏获得掌控感", action: "临时调整时同步新的边界、负责人和截止点" },

  { id: "relationship_active_approach", name: "主动靠近", axis: "EI", domain: "relationship", pole: "E", sourceFacets: ["recovery_space", "interaction_energy"], behavior: "通过主动联系和共同活动维持连接", alternative: "给彼此空间，等状态合适时再靠近", action: "想靠近时提出具体而不施压的邀请" },
  { id: "relationship_personal_space", name: "个人空间", axis: "EI", domain: "relationship", pole: "I", sourceFacets: ["recovery_space", "interaction_energy"], behavior: "需要独立时间恢复并整理关系中的感受", alternative: "通过持续交流确认连接仍然存在", action: "需要空间时同时说明大致时长和回应方式" },
  { id: "relationship_emotional_expression", name: "情绪表达", axis: "EI", domain: "relationship", pole: "E", sourceFacets: ["expression_processing", "initiative_visibility"], behavior: "愿意把当下感受及时说出来", alternative: "先在内部消化，确认意思后再表达", action: "强烈情绪出现时先说感受，再讨论结论" },
  { id: "relationship_internal_processing", name: "内部消化", axis: "EI", domain: "relationship", pole: "I", sourceFacets: ["expression_processing", "initiative_visibility"], behavior: "先独自理解情绪和需要，再进入沟通", alternative: "在来回交流中逐渐明白自己的感受", action: "沉默整理时先告诉对方你会回来继续谈" },

  { id: "relationship_factual_communication", name: "事实沟通", axis: "SN", domain: "relationship", pole: "S", sourceFacets: ["fact_detail", "communication_memory"], behavior: "依据具体言行和已经发生的事实理解关系", alternative: "从语气、背景和变化趋势推测更深含义", action: "产生猜测时先核对一件具体发生的事" },
  { id: "relationship_implicit_signal", name: "隐含信息感知", axis: "SN", domain: "relationship", pole: "N", sourceFacets: ["fact_detail", "communication_memory"], behavior: "留意语气、节奏和前后变化中的隐含信号", alternative: "相信明确表达，不轻易为细节增加解释", action: "察觉信号后用开放问题确认，而不是独自推演" },
  { id: "relationship_action_trust", name: "行动信任", axis: "SN", domain: "relationship", pole: "S", sourceFacets: ["pattern_possibility", "practical_experiment"], behavior: "通过稳定行动和具体兑现建立信任", alternative: "更重视关系的潜力、理解深度和未来方向", action: "重要承诺尽量转成可观察的具体行动" },
  { id: "relationship_deep_understanding", name: "深层理解", axis: "SN", domain: "relationship", pole: "N", sourceFacets: ["pattern_possibility", "practical_experiment"], behavior: "持续理解行为背后的动机和关系意义", alternative: "先回应眼前事实，不过度延伸解释", action: "深挖原因前先确认对方是否愿意谈得更深" },

  { id: "relationship_problem_solving", name: "问题解决", axis: "TF", domain: "relationship", pole: "T", sourceFacets: ["logic_consistency", "conflict_feedback"], behavior: "冲突中优先厘清问题并寻找可执行办法", alternative: "先承接情绪，等彼此被理解后再处理问题", action: "给建议前先问对方需要陪伴还是办法" },
  { id: "relationship_emotional_holding", name: "情绪承接", axis: "TF", domain: "relationship", pole: "F", sourceFacets: ["logic_consistency", "conflict_feedback"], behavior: "先让对方的感受被听见和接住", alternative: "快速聚焦原因、责任和解决路径", action: "承接情绪后再一起确认下一步需要什么" },
  { id: "relationship_boundary_clarity", name: "边界清晰", axis: "TF", domain: "relationship", pole: "T", sourceFacets: ["fairness_support", "empathy_attunement"], behavior: "即使担心失望，也会说明不合理之处和边界", alternative: "优先维护气氛，再寻找更柔和的表达时机", action: "表达边界时同时说明你重视这段关系" },
  { id: "relationship_harmony_maintenance", name: "和谐维护", axis: "TF", domain: "relationship", pole: "F", sourceFacets: ["fairness_support", "empathy_attunement"], behavior: "关注表达方式，尽量减少对关系的伤害", alternative: "把观点说清楚比维持短期和谐更重要", action: "维护和谐时不要省略真正需要讨论的问题" },

  { id: "relationship_commitment_need", name: "承诺需求", axis: "JP", domain: "relationship", pole: "J", sourceFacets: ["planning_structure", "routine_deadline"], behavior: "通过明确安排、回应和关系方向获得安心", alternative: "让关系自然发展，不急于定义每个阶段", action: "需要确定时提出具体问题，避免用试探代替沟通" },
  { id: "relationship_flexibility", name: "关系弹性", axis: "JP", domain: "relationship", pole: "P", sourceFacets: ["planning_structure", "routine_deadline"], behavior: "允许关系节奏随现实情况调整", alternative: "通过稳定计划和清晰预期维持连接", action: "接受变化时也保留最基本的回应约定" },
  { id: "relationship_conflict_repair", name: "冲突修复", axis: "JP", domain: "relationship", pole: "J", sourceFacets: ["closure_decision", "adaptability_change"], behavior: "不喜欢矛盾悬着，会推动确认和收尾", alternative: "需要先拉开距离，等状态变化后再处理", action: "修复冲突时先约定何时谈，不强求立刻解决" },
  { id: "relationship_response_sensitivity", name: "回应敏感度", axis: "JP", domain: "relationship", pole: "P", sourceFacets: ["closure_decision", "adaptability_change"], behavior: "会根据对方当下反应及时调整互动节奏", alternative: "更依赖明确约定，不轻易因短期反应改变方向", action: "调整节奏前区分一次波动和持续变化" },
];

function extractContext(prompt) {
  return prompt.startsWith("当")
    ? prompt.slice(1).replace(/时，你通常更倾向于：$/, "")
    : prompt.replace(/。哪种后续状态更接近你？$/, "");
}

function compactStatement(context, behavior) {
  let text = `当${context}时，我会${behavior.replace(/[。；;]$/, "")}。`;
  if (text.length > 48) {
    text = text
      .replaceAll("当下", "")
      .replaceAll("明显", "")
      .replaceAll("通常", "")
      .replaceAll("自己为什么", "为何");
  }
  return text;
}

function responseTemplate(type, direction, question) {
  const opposite = direction * -1;
  const poleFor = (score) => score === 2 ? question.rightPole : question.leftPole;
  if (type === "selfMatch") {
    return [
      { id: "veryLike", label: "很像我", score: direction, pole: poleFor(direction) },
      { id: "depends", label: "看情况", score: 0 },
      { id: "notLike", label: "不太像我", score: opposite, pole: poleFor(opposite) },
    ];
  }
  if (type === "frequency") {
    return [
      { id: "often", label: "经常会", score: direction, pole: poleFor(direction) },
      { id: "sometimes", label: "偶尔会", score: 0 },
      { id: "rarely", label: "很少会", score: opposite, pole: poleFor(opposite) },
    ];
  }

  const directional = question.options.filter((option) => option.score !== 0);
  const ordered = Number(question.id.slice(1)) % 2 === 0 ? directional : [...directional].reverse();
  return [
    { id: "closerA", label: ordered[0].text, score: ordered[0].score * 2, pole: ordered[0].pole },
    { id: "depends", label: "要看情况", score: 0 },
    { id: "closerB", label: ordered[1].text, score: ordered[1].score * 2, pole: ordered[1].pole },
  ];
}

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const generated = [];
const idMap = {};

for (const question of source.questions) {
  const context = extractContext(question.prompt);
  const directional = question.options.filter((option) => option.score !== 0);
  for (const behavior of directional) {
    const direction = behavior.score * 2;
    const pole = behavior.pole;
    const traitCandidates = traits.filter((item) =>
      item.axis === question.axis &&
      item.domain === question.domain &&
      item.pole === pole,
    );
    if (traitCandidates.length !== 2) throw new Error(`No trait pair for ${question.id}/${pole}`);
    const suffix = direction === 2 ? "R" : "L";
    const id = `IC3-${question.id}-${suffix}`;
    idMap[`${question.id}-${suffix}`] = id;
    generated.push({ question, behavior, context, direction, traitCandidates, id });
  }
}

for (const axis of ["EI", "SN", "TF", "JP"]) {
  for (const domain of ["life", "relationship"]) {
    const poles = axis.split("");
    for (const pole of poles) {
      const items = generated
        .filter((item) => item.question.axis === axis && item.question.domain === domain && item.behavior.pole === pole)
        .sort((a, b) => a.id.localeCompare(b.id));
      const counts = new Map(items[0].traitCandidates.map((trait) => [trait.id, 0]));
      for (const item of items) {
        const preferred = item.traitCandidates.find((trait) => trait.sourceFacets.includes(item.question.facet));
        const alternate = item.traitCandidates.find((trait) => trait.id !== preferred?.id);
        const selected = preferred && (counts.get(preferred.id) ?? 0) < 20 ? preferred : alternate;
        if (!selected || (counts.get(selected.id) ?? 0) >= 20) throw new Error(`Trait capacity failed for ${item.id}`);
        item.trait = selected;
        counts.set(selected.id, (counts.get(selected.id) ?? 0) + 1);
      }
    }
  }
}

for (const trait of traits) {
  const items = generated
    .filter((item) => item.trait.id === trait.id)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (items.length !== 20) throw new Error(`${trait.id} expected 20 questions, got ${items.length}`);
  items.forEach((item, index) => {
    item.responseType = index < 14 ? "selfMatch" : index < 18 ? "frequency" : "directional";
  });
}

const questions = generated.map((item) => {
  const prompt = item.responseType === "directional"
    ? `在${item.context}时，我通常更接近哪一种反应？`
    : compactStatement(item.context, item.behavior.text);
  return {
    id: item.id,
    version: VERSION,
    axis: item.question.axis,
    domain: item.question.domain,
    facetId: item.trait.id,
    facetName: item.trait.name,
    prompt,
    responseType: item.responseType,
    options: responseTemplate(item.responseType, item.direction, item.question),
    reverseScored: item.direction === -2,
    mirrorGroup: `IC3-${item.question.mirrorGroup}`,
    scenarioTag: item.question.scenarioTag,
    readingLength: prompt.length,
    estimatedReadingMs: Math.max(1800, prompt.length * 150),
    weight: 1,
    isOriginal: true,
    isActive: true,
    sourceQuestionId: item.question.id,
  };
});

const meta = {
  name: "InnerCompass 16 原创行为情境题库",
  version: VERSION,
  language: "zh-CN",
  itemCount: questions.length,
  domains: { life: 320, relationship: 320 },
  axes: { EI: 160, SN: 160, TF: 160, JP: 160 },
  responseTypes: { selfMatch: 448, frequency: 128, directional: 64 },
  notice: "用于基于 MBTI 四维框架的非官方自我探索，不构成医学、心理诊断或招聘判断。",
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({ meta, questions }, null, 2)}\n`, "utf8");
await writeFile(catalogPath, `${JSON.stringify({ version: VERSION, traits }, null, 2)}\n`, "utf8");
await writeFile(mappingPath, `${JSON.stringify({ fromVersion: "2.0.0", toVersion: VERSION, mappings: idMap }, null, 2)}\n`, "utf8");

console.log(`Generated ${questions.length} questions across ${traits.length} traits (version ${VERSION}).`);
