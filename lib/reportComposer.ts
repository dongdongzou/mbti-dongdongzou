import traitCatalogJson from "./data/trait_catalog_32.json" with { type: "json" };
import type { Axis, Pole, SessionResult } from "./schemas";

const AXES: Axis[] = ["EI", "SN", "TF", "JP"];

type TraitCatalogItem = {
  id: string;
  name: string;
  axis: Axis;
  domain: "life" | "relationship";
  pole: Pole;
  behavior: string;
  alternative: string;
  action: string;
};

export type TraitInsight = TraitCatalogItem & {
  score: number;
  level: "high" | "balanced" | "low";
  interpretation: string;
};

export type AxisInsight = {
  axis: Axis;
  title: string;
  definition: string;
  dominantPole: Pole;
  dominantPercent: number;
  otherPole: Pole;
  otherPercent: number;
  strengthLabel: string;
  summary: string;
  life: string;
  work: string;
  relationship: string;
  misunderstood: string;
  otherSide: string;
  sceneSwitch?: string;
};

const traits = traitCatalogJson.traits as TraitCatalogItem[];

const legacyTraitIds: Record<string, string> = {
  L_E_SOCIAL: "life_social_initiative", L_I_RECOVER: "life_solitude_recovery",
  L_E_EXPRESS: "life_instant_expression", L_I_THINK: "life_independent_thinking",
  L_S_DETAIL: "life_detail_attention", L_N_PATTERN: "life_pattern_insight",
  L_S_PRACTICAL: "life_practical_grounding", L_N_POSSIBILITY: "life_possibility_exploration",
  L_T_LOGIC: "life_logic_analysis", L_F_EMOTION: "life_emotion_awareness",
  L_T_PRINCIPLE: "life_principle_judgment", L_F_RELATION: "life_relationship_consideration",
  L_J_PLAN: "life_planning_organization", L_P_EXPLORE: "life_free_exploration",
  L_J_CLOSURE: "life_result_closure", L_P_ADAPT: "life_adaptive_flexibility",
  R_E_APPROACH: "relationship_active_approach", R_I_SPACE: "relationship_personal_space",
  R_E_RESPONSE: "relationship_emotional_expression", R_I_PROCESS: "relationship_internal_processing",
  R_S_FACT: "relationship_factual_communication", R_N_SIGNAL: "relationship_implicit_signal",
  R_S_ACTION: "relationship_action_trust", R_N_DEPTH: "relationship_deep_understanding",
  R_T_SOLVE: "relationship_problem_solving", R_F_HOLD: "relationship_emotional_holding",
  R_T_BOUNDARY: "relationship_boundary_clarity", R_F_HARMONY: "relationship_harmony_maintenance",
  R_J_COMMIT: "relationship_commitment_need", R_P_FLEX: "relationship_flexibility",
  R_J_REPAIR: "relationship_conflict_repair", R_P_NATURAL: "relationship_response_sensitivity",
};

const axisCopy: Record<Axis, {
  title: string;
  definition: string;
  left: { life: string; work: string; relationship: string; misunderstood: string; otherSide: string };
  right: { life: string; work: string; relationship: string; misunderstood: string; otherSide: string };
}> = {
  EI: {
    title: "精力恢复与表达顺序",
    definition: "E / I 描述你更常从外部互动还是内部空间获得能量，以及你倾向边说边想还是想好再说。",
    left: {
      life: "你更容易通过交流、活动和外部反馈恢复状态，也较愿意主动打开互动。",
      work: "讨论和即时反馈常能推动你形成想法，你在共同推进中更容易保持行动能量。",
      relationship: "你通常愿意主动联系、分享近况，用持续互动确认连接感。",
      misunderstood: "主动表达不等于缺少深度，你也会独立思考，只是常把交流当作整理信息的一部分。",
      otherSide: "需要形成重要判断或精力下降时，你仍会使用 I 侧的独处和内部整理能力。",
    },
    right: {
      life: "你更容易通过安静和个人空间恢复状态，通常先形成内部判断再表达。",
      work: "独立准备能提升你的判断质量；持续互动可能比独处更消耗精力。",
      relationship: "你未必持续高频表达，但会在想清楚后提供更完整、稳定的回应。",
      misunderstood: "需要空间不等于冷淡或逃避，它常是你恢复精力、整理感受的重要方式。",
      otherSide: "在熟悉领域或安全关系中，你仍能使用 E 侧的主动连接与即时表达能力。",
    },
  },
  SN: {
    title: "事实经验与模式可能",
    definition: "S / N 描述你更常从具体事实与既有经验，还是从联系、趋势和潜在可能理解信息。",
    left: {
      life: "你更信任可观察事实、具体步骤和已经验证的经验。",
      work: "清晰要求、实例和可执行标准能让你快速进入状态，你善于发现落地细节。",
      relationship: "你更重视实际言行和兑现情况，不会轻易为一个细节增加过多解释。",
      misunderstood: "关注现实不等于没有想象力，你只是更希望想法能被事实支撑并转成行动。",
      otherSide: "信息不足或需要创新时，你仍会调用 N 侧的联想和可能性探索。",
    },
    right: {
      life: "你容易从分散信息中看到模式、趋势和尚未出现的可能。",
      work: "你擅长理解整体方向和重新定义问题，但可能对重复细节较快失去耐心。",
      relationship: "你会留意语气、节奏和前后变化，尝试理解行为背后的意义。",
      misunderstood: "关注隐含信息不等于脱离现实，你通常是在寻找能解释更多事实的模型。",
      otherSide: "需要执行和验证时，你仍会使用 S 侧的事实核对与具体行动能力。",
    },
  },
  TF: {
    title: "逻辑标准与关系影响",
    definition: "T / F 描述你做判断时更优先检验逻辑与一致性，还是更优先考虑感受、价值和关系影响；它不等于有没有感情。",
    left: {
      life: "你更常依据因果、规则和一致标准做判断，倾向先解决问题本身。",
      work: "你能指出矛盾并保持判断独立，面对复杂问题时较少被短期气氛带走。",
      relationship: "你表达在意的方式可能是分析问题、提供建议或把不合理之处说清楚。",
      misunderstood: "直接和理性不等于没有感情，你可能只是把解决问题视为一种负责和关心。",
      otherSide: "在重要关系或对方明显受伤时，你仍会使用 F 侧的情绪承接与关系顾及能力。",
    },
    right: {
      life: "你会把决定对具体人的影响纳入判断，较快感知情绪和价值冲突。",
      work: "你善于协调不同需要、维护合作意愿，并让方案更容易被人接受。",
      relationship: "你通常先确认对方是否被理解，再进入事实判断或问题解决。",
      misunderstood: "顾及感受不等于缺乏原则，你只是认为关系后果也是现实的一部分。",
      otherSide: "需要划定边界或处理长期问题时，你仍会使用 T 侧的逻辑分析与原则判断。",
    },
  },
  JP: {
    title: "确定结构与开放调整",
    definition: "J / P 描述你更常通过明确计划和收尾，还是通过保留选择和灵活调整获得掌控感；它不等于自律或拖延。",
    left: {
      life: "你更喜欢提前确定方向、顺序和截止点，悬而未决会持续占用注意力。",
      work: "你善于组织资源、推动决定和完成闭环，明确标准会提升你的效率。",
      relationship: "你更重视回应、安排和关系方向的清晰度，不喜欢重要问题长期搁置。",
      misunderstood: "需要计划不等于僵化，你常是通过结构为真正重要的事情保留精力。",
      otherSide: "环境快速变化时，你仍会使用 P 侧的临场调整和开放探索能力。",
    },
    right: {
      life: "你更愿意保留选择，边行动边吸收新信息，不喜欢过早固定所有细节。",
      work: "你在变化和模糊任务中适应较快，但重复收尾或长期固定流程可能消耗动力。",
      relationship: "你倾向让关系自然发展，并根据彼此状态调整互动节奏。",
      misunderstood: "保留开放不等于没有责任感，你只是希望决定建立在足够信息之上。",
      otherSide: "遇到高风险任务或明确承诺时，你仍会使用 J 侧的计划、组织和闭环能力。",
    },
  },
};

const flowStep: Record<Pole, string> = {
  E: "通过连接获得反馈",
  I: "先在内部整理",
  S: "核对事实与经验",
  N: "寻找模式与可能",
  T: "用逻辑和标准检验",
  F: "评估感受与关系影响",
  J: "确定顺序并推动收尾",
  P: "保留空间并随信息调整",
};

function strength(percent: number): string {
  if (percent <= 54) return "接近中线";
  if (percent <= 64) return "轻度偏好";
  if (percent <= 74) return "明显偏好";
  if (percent <= 84) return "强偏好";
  return "极强偏好";
}

function traitInsight(item: TraitCatalogItem, result: SessionResult): TraitInsight {
  const score = Math.round(result.facetScores[item.id] ?? result.facetScores[legacyTraitIds[item.id]] ?? 50);
  const level = score >= 65 ? "high" : score <= 35 ? "low" : "balanced";
  const interpretation = level === "high"
    ? `你较常通过${item.behavior}。这是一种稳定可用的行为资源，但不代表你只能这样反应。`
    : level === "low"
      ? `你较少依赖${item.behavior}，多数情况下更可能${item.alternative}。低分不代表缺点，只表示这不是你的首选路径。`
      : `你会在${item.behavior}与${item.alternative}之间根据场景切换，目前没有单一方式持续占优。`;
  return { ...item, score, level, interpretation };
}

function axisInsight(axis: Axis, result: SessionResult): AxisInsight {
  const score = result.axes[axis];
  const useRight = score.rightPercent > score.leftPercent;
  const dominantPole = (useRight ? score.rightPole : score.leftPole) as Pole;
  const otherPole = (useRight ? score.leftPole : score.rightPole) as Pole;
  const dominantPercent = Math.round(useRight ? score.rightPercent : score.leftPercent);
  const otherPercent = 100 - dominantPercent;
  const copy = useRight ? axisCopy[axis].right : axisCopy[axis].left;
  const lifeScore = result.domainAxes.life[axis];
  const relationshipScore = result.domainAxes.relationship[axis];
  const lifeDominant = useRight ? lifeScore.rightPercent : lifeScore.leftPercent;
  const relationshipDominant = useRight ? relationshipScore.rightPercent : relationshipScore.leftPercent;
  const gap = Math.abs(lifeScore.rightPercent - relationshipScore.rightPercent);
  return {
    axis,
    title: axisCopy[axis].title,
    definition: axisCopy[axis].definition,
    dominantPole,
    dominantPercent,
    otherPole,
    otherPercent,
    strengthLabel: strength(dominantPercent),
    summary: `在本次有效回答中，你有约 ${dominantPercent}% 的倾向更接近 ${dominantPole} 侧描述，属于“${strength(dominantPercent)}”。这表示当前题库与场景下的偏好方向，不是人格成分、能力水平或永久不变的本质。`,
    life: `${copy.life} 在生活题中，${dominantPole} 侧约为 ${Math.round(lifeDominant)}%。`,
    work: copy.work,
    relationship: `${copy.relationship} 在感情题中，${dominantPole} 侧约为 ${Math.round(relationshipDominant)}%。`,
    misunderstood: copy.misunderstood,
    otherSide: copy.otherSide,
    sceneSwitch: gap >= 12 ? `生活与感情场景相差 ${Math.round(gap)} 分，说明你会根据关系距离、精力或安全感调整这一维度的行为权重。` : undefined,
  };
}

function confidence(result: SessionResult, runs: SessionResult[]): number {
  const boundaryCount = AXES.filter((axis) => result.axes[axis].boundaryLabel === "near-boundary").length;
  const completion = result.completionRate * 100;
  const speedPenalty = result.tooFastRate * 18;
  const uniformPenalty = Math.max(0, (result.dominantOptionRate ?? 0) - 0.82) * 35;
  const boundaryPenalty = boundaryCount * 2;
  const runBonus = Math.min(6, Math.max(0, runs.length - 1) * 3);
  return Math.round(Math.max(35, Math.min(98, completion - speedPenalty - uniformPenalty - boundaryPenalty + runBonus)));
}

function runStability(runs: SessionResult[]) {
  return AXES.map((axis) => {
    const values = runs.map((run) => run.axes[axis].rightPercent);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const sd = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
    return { axis, change: Math.round((Math.max(...values) - Math.min(...values)) * 10) / 10, sd: Math.round(sd * 10) / 10 };
  });
}

export function typeCodeFor(result: SessionResult): string {
  return AXES.map((axis) => result.axes[axis].rightPercent > 50 ? result.axes[axis].rightPole : result.axes[axis].leftPole).join("");
}

export function composeReport(result: SessionResult, completedRuns: SessionResult[] = []) {
  const typeCode = typeCodeFor(result);
  const axes = AXES.map((axis) => axisInsight(axis, result));
  const traitScores = traits.map((item) => traitInsight(item, result)).sort((a, b) => b.score - a.score);
  const strongestAxes = [...axes].sort((a, b) => b.dominantPercent - a.dominantPercent);
  const closestAxis = strongestAxes.at(-1)!;
  const flow = axes.map((item) => flowStep[item.dominantPole]);
  const gaps = axes.filter((item) => item.sceneSwitch).map((item) => ({ axis: item.axis, text: item.sceneSwitch! }));
  const lifeTraits = traitScores.filter((item) => item.domain === "life");
  const relationshipTraits = traitScores.filter((item) => item.domain === "relationship");
  const axisBy = Object.fromEntries(axes.map((item) => [item.axis, item])) as Record<Axis, AxisInsight>;
  const traitBy = Object.fromEntries(traitScores.map((item) => [item.id, item])) as Record<string, TraitInsight>;
  const runs = completedRuns.length ? completedRuns : [result];
  const quality = {
    confidence: confidence(result, runs),
    answered: result.answeredCount,
    planned: result.plannedCount,
    missedRate: Math.round((1 - result.completionRate) * 100),
    medianSeconds: Math.round(result.medianResponseMs / 100) / 10,
    tooFastPercent: Math.round(result.tooFastRate * 100),
    boundaryCount: axes.filter((item) => item.strengthLabel === "接近中线").length,
    dominantOptionPercent: Math.round((result.dominantOptionRate ?? 0) * 100),
    bankVersion: result.bankVersion ?? "legacy",
  };
  return {
    typeCode,
    axes,
    traits: traitScores,
    topTraits: traitScores.slice(0, 6),
    middleTraits: traitScores.slice(6, 26),
    bottomTraits: traitScores.slice(-6).reverse(),
    lifeTraits,
    relationshipTraits,
    gaps,
    flow,
    flowTitle: flow.join(" → "),
    overview: `你的 ${typeCode} 由四个明显程度不同的偏好共同组成。${strongestAxes.slice(0, 2).map((item) => `${item.dominantPole}（${item.dominantPercent}%）`).join("、")}较为清晰；${closestAxis.dominantPole}（${closestAxis.dominantPercent}%）${closestAxis.strengthLabel === "接近中线" ? "接近中线，因此更容易随场景切换" : `为${closestAxis.strengthLabel}，因此你也会较常使用 ${closestAxis.otherPole} 侧能力`}。`,
    behaviorLogic: `面对新情况时，你较常沿着“${flow.join(" → ")}”的顺序组织反应。四个步骤的强弱并不相同，因此这是一条可调整的常用路径，而不是固定程序。`,
    lifeSummary: `生活场景中，你最常依赖的特质是${lifeTraits.slice(0, 3).map((item) => `${item.name}（${item.score}）`).join("、")}；较少依赖的是${[...lifeTraits].sort((a, b) => a.score - b.score).slice(0, 2).map((item) => item.name).join("、")}。`,
    relationshipSummary: `亲密关系中，你较常通过${relationshipTraits.slice(0, 3).map((item) => item.behavior).join("、")}表达和维持关系。`,
    lifeTopics: [
      { title: "精力恢复", text: axisBy.EI.life },
      { title: "社交方式", text: `${traitBy.L_E_SOCIAL.interpretation} ${traitBy.L_I_RECOVER.interpretation}` },
      { title: "信息处理", text: axisBy.SN.life },
      { title: "决策方式", text: axisBy.TF.life },
      { title: "学习特点", text: axisBy.SN.work },
      { title: "工作推进", text: `${axisBy.JP.work} 计划组织度为 ${traitBy.L_J_PLAN.score}，结果闭环度为 ${traitBy.L_J_CLOSURE.score}。` },
      { title: "面对变化", text: `${traitBy.L_P_ADAPT.interpretation} 当前得分 ${traitBy.L_P_ADAPT.score}。` },
      { title: "消费与资源", text: `你会在${traitBy.L_S_DETAIL.behavior}与${traitBy.L_N_POSSIBILITY.behavior}之间分配注意力；两项得分分别为 ${traitBy.L_S_DETAIL.score} 和 ${traitBy.L_N_POSSIBILITY.score}。` },
      { title: "日常秩序", text: `${traitBy.L_J_PLAN.interpretation} ${traitBy.L_P_EXPLORE.interpretation}` },
      { title: "压力下表现", text: `压力升高时，最强的 ${strongestAxes[0].dominantPole} 偏好（${strongestAxes[0].dominantPercent}%）可能更快接管反应；可以主动调用 ${strongestAxes[0].otherPole} 侧能力扩大选择。` },
    ],
    relationshipTopics: [
      { title: "如何靠近一个人", text: `${traitBy.R_E_APPROACH.interpretation} 当前得分 ${traitBy.R_E_APPROACH.score}。` },
      { title: "如何表达喜欢", text: `${traitBy.R_E_RESPONSE.interpretation} 你也可能通过${traitBy.R_S_ACTION.behavior}表达在意。` },
      { title: "如何确认安全感", text: `${traitBy.R_J_COMMIT.interpretation} 个人空间得分为 ${traitBy.R_I_SPACE.score}，两者共同决定你需要的连接节奏。` },
      { title: "如何理解对方", text: `${traitBy.R_S_FACT.interpretation} ${traitBy.R_N_SIGNAL.interpretation}` },
      { title: "面对冷淡和不确定", text: `回应敏感度为 ${traitBy.R_E_RESPONSE.score}，深层理解为 ${traitBy.R_N_DEPTH.score}。信息不足时，你可能在核对事实与推演原因之间来回切换。` },
      { title: "如何处理冲突", text: `${traitBy.R_T_SOLVE.interpretation} ${traitBy.R_F_HOLD.interpretation}` },
      { title: "为什么可能突然抽离", text: `当个人空间（${traitBy.R_I_SPACE.score}）或内部消化（${traitBy.R_I_PROCESS.score}）需求升高时，你可能先减少互动以恢复秩序；这不自动等于不在意。` },
      { title: "更适合的沟通方式", text: `把事实、感受和下一步分开表达会更清楚。你可以直接使用这个动作：${relationshipTraits[0].action}。` },
    ],
    strengths: traitScores.slice(0, 6).map((item) => ({ title: `${item.name} · ${item.score}`, text: item.interpretation })),
    watchouts: traitScores.slice(-5).reverse().map((item) => ({
      title: `较少依赖：${item.name}`,
      text: `你可能较少通过${item.behavior}来应对。别人有时会把这种差异理解为你忽略了这一路径，尤其在压力或信息不足时。可以尝试：${item.action}。`,
    })),
    growth: [...traitScores.slice(0, 3), ...traitScores.slice(-2)].map((item) => ({ title: item.action, text: `当${item.name}成为当前场景的关键变量时，先做这个小动作，再观察对方或环境的反馈。` })),
    runValidation: {
      count: runs.length,
      label: runs.length >= 3 ? "稳定画像" : runs.length === 2 ? "待验证画像" : "初步画像",
      axes: runStability(runs),
    },
    quality,
  };
}

export const REQUIRED_DISCLAIMER = "本工具使用原创情境题估计行为偏好，基于 MBTI 四维框架进行自我探索，不属于官方 MBTI 认证测评，也不构成医学、心理诊断或招聘判断。";
