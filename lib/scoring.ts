import type {
  AggregateResult,
  Axis,
  AxisScore,
  Domain,
  Question,
  ResponseType,
  ResponseRecord,
  SessionResult,
} from "./schemas";

const AXES: Axis[] = ["EI", "SN", "TF", "JP"];
const DOMAINS: Domain[] = ["life", "relationship"];
const POLES: Record<Axis, [string, string]> = {
  EI: ["E", "I"],
  SN: ["S", "N"],
  TF: ["T", "F"],
  JP: ["J", "P"],
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalizedScore(score: ResponseRecord["score"]): number {
  if (score === null) return 0;
  return clamp(score / (Math.abs(score) > 1 ? 2 : 1), -1, 1);
}

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function constrainedOrder(items: Question[], random: () => number): Question[] {
  const remaining = shuffle(items, random);
  const ordered: Question[] = [];

  while (remaining.length) {
    const recent = ordered.slice(-2);
    const valid = remaining
      .map((question, index) => ({ question, index }))
      .filter(({ question }) =>
        !(recent.length === 2 &&
          (recent.every((item) => item.axis === question.axis) ||
            recent.every((item) => item.domain === question.domain))),
      );
    const pool = valid.length
      ? valid
      : remaining.map((question, index) => ({ question, index }));
    const picked = pool[Math.floor(random() * pool.length)];
    ordered.push(picked.question);
    remaining.splice(picked.index, 1);
  }

  return ordered;
}

function boundaryLabel(margin: number): AxisScore["boundaryLabel"] {
  if (margin <= 8) return "near-boundary";
  if (margin <= 28) return "mild";
  if (margin <= 48) return "clear";
  if (margin <= 68) return "strong";
  return "extreme";
}

function scoreAxis(
  axis: Axis,
  questions: Question[],
  responses: Map<string, ResponseRecord>,
): AxisScore {
  const axisQuestions = questions.filter((q) => q.axis === axis);
  const answered = axisQuestions
    .map((q) => responses.get(q.id))
    .filter((r): r is ResponseRecord => Boolean(r && r.score !== null));

  const mean =
    answered.length === 0
      ? 0
      : answered.reduce((sum, r) => sum + normalizedScore(r.score), 0) / answered.length;

  const rightPercent = round1(clamp(((mean + 1) / 2) * 100, 0, 100));
  const leftPercent = round1(100 - rightPercent);
  const margin = round1(Math.abs(leftPercent - rightPercent));

  return {
    axis,
    leftPole: POLES[axis][0] as AxisScore["leftPole"],
    rightPole: POLES[axis][1] as AxisScore["rightPole"],
    leftPercent,
    rightPercent,
    answered: answered.length,
    timedOut: axisQuestions.length - answered.length,
    margin,
    boundaryLabel: boundaryLabel(margin),
  };
}

function allocateAcrossCells(
  total: number,
  cellTargets: Map<string, number>,
  random: () => number,
): Map<string, number> {
  const grandTotal = [...cellTargets.values()].reduce((sum, value) => sum + value, 0);
  const result = new Map<string, number>();
  const fractions: Array<{ key: string; fraction: number }> = [];
  let assigned = 0;
  for (const [key, target] of cellTargets) {
    const exact = total * target / grandTotal;
    const base = Math.floor(exact);
    result.set(key, base);
    fractions.push({ key, fraction: exact - base + random() * 0.0001 });
    assigned += base;
  }
  for (const item of fractions.sort((a, b) => b.fraction - a.fraction)) {
    if (assigned >= total) break;
    result.set(item.key, (result.get(item.key) ?? 0) + 1);
    assigned += 1;
  }
  return result;
}

function cellTargetsFor(count: number, seed: number): Map<string, number> {
  if (count === 80 || count === 120) {
    const each = count / 8;
    return new Map(AXES.flatMap((axis) => DOMAINS.map((domain) => [`${axis}-${domain}`, each] as const)));
  }
  if (count === 100) {
    const lifeHigh = seed % 2 === 0 ? new Set<Axis>(["EI", "TF"]) : new Set<Axis>(["SN", "JP"]);
    return new Map(AXES.flatMap((axis) => [
      [`${axis}-life`, lifeHigh.has(axis) ? 13 : 12] as const,
      [`${axis}-relationship`, lifeHigh.has(axis) ? 12 : 13] as const,
    ]));
  }

  const cells = AXES.flatMap((axis) => DOMAINS.map((domain) => `${axis}-${domain}`));
  const base = Math.floor(count / cells.length);
  return new Map(cells.map((key, index) => [key, base + (index < count % cells.length ? 1 : 0)]));
}

/** 分层抽题：固定维度/场景配额，同时约束 32 特质、答案模板、正反向与镜像组。 */
export function selectQuestions(
  bank: Question[],
  requestedCount = 100,
  recentQuestionIds: string[] = [],
  seed = Date.now(),
): Question[] {
  const count = Math.round(clamp(requestedCount, 80, 120));
  const random = mulberry32(seed);
  const recent = new Set(recentQuestionIds);
  const targets = cellTargetsFor(count, seed);
  const selfTargets = allocateAcrossCells(Math.round(count * 0.7), targets, random);
  const frequencyTargets = allocateAcrossCells(Math.round(count * 0.2), targets, random);
  const reverseTargets = allocateAcrossCells(Math.floor(count / 2), targets, random);

  const chosen: Question[] = [];
  const chosenIds = new Set<string>();
  const mirrorGroups = new Set<string>();

  for (const [key, target] of shuffle([...targets.entries()], random)) {
    const [axis, domain] = key.split("-") as [Axis, Domain];
    const pool = shuffle(bank.filter((q) => q.axis === axis && q.domain === domain && q.isActive), random);
    const preferred = [...pool.filter((q) => !recent.has(q.id)), ...pool.filter((q) => recent.has(q.id))];
    const facets = shuffle([...new Set(pool.map((q) => q.facetId))], random);
    const facetTargets = new Map<string, number>();
    facets.forEach((facet, index) => facetTargets.set(facet, Math.floor(target / facets.length) + (index < target % facets.length ? 1 : 0)));
    const responseTargets = new Map<ResponseType, number>([
      ["selfMatch", selfTargets.get(key) ?? 0],
      ["frequency", frequencyTargets.get(key) ?? 0],
    ]);
    responseTargets.set("directional", target - [...responseTargets.values()].reduce((sum, value) => sum + value, 0));
    const directionTargets = new Map([[true, reverseTargets.get(key) ?? 0], [false, target - (reverseTargets.get(key) ?? 0)]]);
    const facetCounts = new Map<string, number>();
    const responseCounts = new Map<ResponseType, number>();
    const directionCounts = new Map<boolean, number>();
    const cellChosen: Question[] = [];

    while (cellChosen.length < target) {
      const available = preferred.filter((q) => !chosenIds.has(q.id) && !mirrorGroups.has(q.mirrorGroup));
      const facetNeeded = (q: Question) => (facetCounts.get(q.facetId) ?? 0) < (facetTargets.get(q.facetId) ?? 0);
      const responseNeeded = (q: Question) => (responseCounts.get(q.responseType) ?? 0) < (responseTargets.get(q.responseType) ?? 0);
      const directionNeeded = (q: Question) => (directionCounts.get(q.reverseScored) ?? 0) < (directionTargets.get(q.reverseScored) ?? 0);
      const selectors = [
        (q: Question) => facetNeeded(q) && responseNeeded(q) && directionNeeded(q),
        (q: Question) => facetNeeded(q) && responseNeeded(q),
        (q: Question) => responseNeeded(q) && directionNeeded(q),
        (q: Question) => responseNeeded(q),
        (q: Question) => facetNeeded(q) && directionNeeded(q),
        (q: Question) => facetNeeded(q),
        (q: Question) => directionNeeded(q),
        () => true,
      ];
      const picked = selectors.map((selector) => available.find(selector)).find(Boolean);
      if (!picked) break;
      cellChosen.push(picked);
      chosen.push(picked);
      chosenIds.add(picked.id);
      mirrorGroups.add(picked.mirrorGroup);
      facetCounts.set(picked.facetId, (facetCounts.get(picked.facetId) ?? 0) + 1);
      responseCounts.set(picked.responseType, (responseCounts.get(picked.responseType) ?? 0) + 1);
      directionCounts.set(picked.reverseScored, (directionCounts.get(picked.reverseScored) ?? 0) + 1);
    }
  }

  // 极端情况下补齐，但仍不重复题目或镜像组。
  if (chosen.length < count) {
    for (const q of shuffle(bank, random)) {
      if (chosen.length >= count) break;
      if (!chosenIds.has(q.id) && !mirrorGroups.has(q.mirrorGroup)) {
        chosen.push(q);
        chosenIds.add(q.id);
        mirrorGroups.add(q.mirrorGroup);
      }
    }
  }

  return constrainedOrder(chosen.slice(0, count), random);
}

export function computeSessionResult(
  sessionId: string,
  questions: Question[],
  responseList: ResponseRecord[],
): SessionResult {
  const responses = new Map(responseList.map((r) => [r.questionId, r]));
  const answered = responseList.filter((r) => r.score !== null);
  const elapsed = answered.map((r) => r.elapsedMs).sort((a, b) => a - b);
  const medianResponseMs =
    elapsed.length === 0
      ? 0
      : elapsed.length % 2 === 1
        ? elapsed[(elapsed.length - 1) / 2]
        : (elapsed[elapsed.length / 2 - 1] + elapsed[elapsed.length / 2]) / 2;

  const tooFastRate =
    answered.length === 0
      ? 1
      : answered.filter((r) => r.elapsedMs < 650).length / answered.length;
  const completionRate = questions.length === 0 ? 0 : answered.length / questions.length;

  // 反应过快只影响数据质量，不直接改变人格维度分数。
  const qualityWeight = clamp(completionRate * (1 - tooFastRate * 0.25), 0.2, 1);

  const axes = Object.fromEntries(
    AXES.map((axis) => [axis, scoreAxis(axis, questions, responses)]),
  ) as Record<Axis, AxisScore>;

  const domainAxes = Object.fromEntries(
    DOMAINS.map((domain) => {
      const domainQuestions = questions.filter((q) => q.domain === domain);
      return [
        domain,
        Object.fromEntries(
          AXES.map((axis) => [axis, scoreAxis(axis, domainQuestions, responses)]),
        ),
      ];
    }),
  ) as SessionResult["domainAxes"];

  const facetScores: Record<string, number> = {};
  const facets = [...new Set(questions.map((q) => q.facetId))];
  for (const facet of facets) {
    const facetQuestions = questions.filter((q) => q.facetId === facet);
    const values = facetQuestions
      .map((question) => {
        const score = responses.get(question.id)?.score;
        if (score === null || score === undefined) return undefined;
        const normalized = normalizedScore(score);
        return question.reverseScored ? normalized * -1 : normalized;
      })
      .filter((value): value is number => value !== undefined);
    const mean = values.length ? values.reduce<number>((a, b) => a + b, 0) / values.length : 0;
    facetScores[facet] = round1(((mean + 1) / 2) * 100);
  }

  const responseTypeCounts = { selfMatch: 0, frequency: 0, directional: 0 };
  questions.forEach((question) => { responseTypeCounts[question.responseType] += 1; });
  const optionSelectionCounts: Record<string, number> = {};
  answered.forEach((response) => {
    if (response.selectedOptionId) optionSelectionCounts[response.selectedOptionId] = (optionSelectionCounts[response.selectedOptionId] ?? 0) + 1;
  });
  const dominantOptionRate = answered.length
    ? Math.max(0, ...Object.values(optionSelectionCounts)) / answered.length
    : 1;

  // 同一 mirrorGroup 在一次问卷中不会重复，因此这里保留 0。
  const contradictionRate = 0;

  return {
    sessionId,
    createdAt: new Date().toISOString(),
    plannedCount: questions.length,
    answeredCount: answered.length,
    completionRate: round1(completionRate * 100) / 100,
    medianResponseMs: Math.round(medianResponseMs),
    tooFastRate: round1(tooFastRate * 100) / 100,
    qualityWeight: round1(qualityWeight * 100) / 100,
    bankVersion: questions[0]?.version ?? "legacy",
    responseTypeCounts,
    optionSelectionCounts,
    dominantOptionRate: round1(dominantOptionRate * 100) / 100,
    axes,
    domainAxes,
    facetScores,
    contradictionRate,
  };
}

function weightedMean(values: number[], weights: number[]): number {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (!values.length || totalWeight === 0) return 50;
  return values.reduce((sum, value, i) => sum + value * weights[i], 0) / totalWeight;
}

function weightedSd(values: number[], weights: number[]): number {
  if (values.length <= 1) return 0;
  const mean = weightedMean(values, weights);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const variance =
    values.reduce((sum, value, i) => sum + weights[i] * (value - mean) ** 2, 0) /
    Math.max(totalWeight, 1);
  return Math.sqrt(variance);
}

function toFeaturePair(
  leftName: string,
  rightName: string,
  rightPercent: number,
): Record<string, number> {
  return {
    [leftName]: round1(100 - rightPercent),
    [rightName]: round1(rightPercent),
  };
}

export function aggregateRuns(runs: SessionResult[]): AggregateResult {
  if (!runs.length) {
    throw new Error("At least one completed run is required.");
  }

  const weights = runs.map((r) => r.qualityWeight);
  const aggregateAxes = {} as AggregateResult["axes"];
  let typeCode = "";

  for (const axis of AXES) {
    const values = runs.map((r) => r.axes[axis].rightPercent);
    const rightPercent = round1(weightedMean(values, weights));
    const leftPercent = round1(100 - rightPercent);
    const margin = round1(Math.abs(leftPercent - rightPercent));
    const sd = round1(weightedSd(values, weights));
    const [leftPole, rightPole] = POLES[axis];

    typeCode += rightPercent > 50 ? rightPole : leftPole;
    aggregateAxes[axis] = {
      axis,
      leftPole: leftPole as AxisScore["leftPole"],
      rightPole: rightPole as AxisScore["rightPole"],
      leftPercent,
      rightPercent,
      answered: runs.reduce((sum, r) => sum + r.axes[axis].answered, 0),
      timedOut: runs.reduce((sum, r) => sum + r.axes[axis].timedOut, 0),
      margin,
      boundaryLabel: boundaryLabel(margin),
      runStandardDeviation: sd,
      stabilityLabel: sd <= 6 ? "stable" : sd <= 12 ? "moderate" : "unstable",
    };
  }

  const lifeRight = Object.fromEntries(
    AXES.map((axis) => [
      axis,
      weightedMean(runs.map((r) => r.domainAxes.life[axis].rightPercent), weights),
    ]),
  ) as Record<Axis, number>;

  const relRight = Object.fromEntries(
    AXES.map((axis) => [
      axis,
      weightedMean(runs.map((r) => r.domainAxes.relationship[axis].rightPercent), weights),
    ]),
  ) as Record<Axis, number>;

  const lifeFeatureScores = {
    ...toFeaturePair("外部互动驱动", "独处恢复需求", lifeRight.EI),
    ...toFeaturePair("现实落地度", "可能性探索度", lifeRight.SN),
    ...toFeaturePair("逻辑决策度", "情感顾及度", lifeRight.TF),
    ...toFeaturePair("计划闭环度", "灵活应变度", lifeRight.JP),
  };

  const relationshipFeatureScores = {
    ...toFeaturePair("主动表达倾向", "内部消化倾向", relRight.EI),
    ...toFeaturePair("事实沟通倾向", "意义推演倾向", relRight.SN),
    ...toFeaturePair("问题解决倾向", "情绪承接倾向", relRight.TF),
    ...toFeaturePair("承诺规划倾向", "自然发展倾向", relRight.JP),
  };

  const weightedCompletionRate = weightedMean(
    runs.map((r) => r.completionRate * 100),
    weights,
  );
  const meanTooFastRate = weightedMean(runs.map((r) => r.tooFastRate * 100), weights);
  const meanContradictionRate = weightedMean(
    runs.map((r) => r.contradictionRate * 100),
    weights,
  );
  const meanStability = AXES.reduce(
    (sum, axis) => sum + Math.max(0, 100 - aggregateAxes[axis].runStandardDeviation * 5),
    0,
  ) / AXES.length;
  const runFactor = clamp(runs.length / 3, 0.45, 1);

  const overallConfidence = round1(
    clamp(
      (weightedCompletionRate * 0.35 +
        meanStability * 0.35 +
        (100 - meanTooFastRate) * 0.15 +
        (100 - meanContradictionRate) * 0.15) *
        runFactor,
      0,
      100,
    ),
  );

  return {
    typeCode,
    runCount: runs.length,
    overallConfidence,
    axes: aggregateAxes,
    lifeFeatureScores,
    relationshipFeatureScores,
    dataQuality: {
      weightedCompletionRate: round1(weightedCompletionRate),
      meanContradictionRate: round1(meanContradictionRate),
      meanTooFastRate: round1(meanTooFastRate),
    },
  };
}
