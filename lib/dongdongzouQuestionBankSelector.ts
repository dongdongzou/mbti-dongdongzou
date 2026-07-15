export type Axis = "EI" | "SN" | "TF" | "JP";
export type Domain = "life" | "relationship";
export type ResponseType = "selfMatch" | "frequency" | "directional";

export interface QuestionOption {
  id: "A" | "B" | "C";
  label: string;
  axisScore: -2 | 0 | 2;
  traitScore: -2 | 0 | 2;
  pole: "E" | "I" | "S" | "N" | "T" | "F" | "J" | "P" | null;
}

export interface Question {
  id: string;
  bankVersion: string;
  axis: Axis;
  leftPole: "E" | "S" | "T" | "J";
  rightPole: "I" | "N" | "F" | "P";
  domain: Domain;
  traitId: string;
  traitName: string;
  targetPole: "E" | "I" | "S" | "N" | "T" | "F" | "J" | "P";
  prompt: string;
  responseType: ResponseType;
  responseGuide: string;
  options: QuestionOption[];
  reverseScored: boolean;
  mirrorGroup: string;
  scenarioTag: string;
  readingLength: number;
  estimatedReadingMs: number;
  timeoutMs: number;
  weight: number;
  isOriginal: true;
  isActive: boolean;
}

const AXES: Axis[] = ["EI", "SN", "TF", "JP"];
const DOMAINS: Domain[] = ["life", "relationship"];

function clampQuestionCount(value: number): 80 | 100 | 120 {
  if (value === 80 || value === 100 || value === 120) return value;
  return 100;
}

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function distribute(total: number, keys: string[], offset = 0): Map<string, number> {
  const result = new Map<string, number>();
  const base = Math.floor(total / keys.length);
  let remainder = total % keys.length;
  const rotated = [...keys.slice(offset % keys.length), ...keys.slice(0, offset % keys.length)];

  for (const key of rotated) {
    result.set(key, base + (remainder > 0 ? 1 : 0));
    if (remainder > 0) remainder -= 1;
  }
  return result;
}

function domainTargets(questionCount: 80 | 100 | 120, seed: number): Map<string, number> {
  const targets = new Map<string, number>();

  if (questionCount === 80) {
    for (const axis of AXES) {
      targets.set(`${axis}-life`, 10);
      targets.set(`${axis}-relationship`, 10);
    }
    return targets;
  }

  if (questionCount === 120) {
    for (const axis of AXES) {
      targets.set(`${axis}-life`, 15);
      targets.set(`${axis}-relationship`, 15);
    }
    return targets;
  }

  // 100题：每轴25题，全卷生活50/感情50。
  // 两个轴为生活13/感情12，另两个轴交换；seed决定轮换。
  const offset = Math.abs(seed) % AXES.length;
  const rotated = [...AXES.slice(offset), ...AXES.slice(0, offset)];
  const lifeHeavy = new Set(rotated.slice(0, 2));

  for (const axis of AXES) {
    targets.set(`${axis}-life`, lifeHeavy.has(axis) ? 13 : 12);
    targets.set(`${axis}-relationship`, lifeHeavy.has(axis) ? 12 : 13);
  }
  return targets;
}

function reorderWithRunLimits(
  questions: Question[],
  random: () => number,
): Question[] {
  const remaining = shuffle(questions, random);
  const result: Question[] = [];

  while (remaining.length > 0) {
    const recent = result.slice(-2);
    const valid = remaining
      .map((question, index) => ({ question, index }))
      .filter(({ question }) => !(recent.length === 2 && (
        recent.every((item) => item.axis === question.axis) ||
        recent.every((item) => item.domain === question.domain)
      )));
    const alternating = valid.filter(({ question }) => question.domain !== result.at(-1)?.domain);
    const pool = alternating.length ? alternating : valid.length ? valid : remaining.map((question, index) => ({ question, index }));
    const picked = pool[Math.floor(random() * pool.length)];
    result.push(picked.question);
    remaining.splice(picked.index, 1);
  }

  return result;
}

/**
 * 从DONGDONGZOU v2题库抽取80/100/120题。
 * - 四维度严格平衡；
 * - 生活/感情严格或总体平衡；
 * - 32项特质尽量均衡；
 * - 单轮同一mirrorGroup最多1题；
 * - 优先避开最近三轮题目；
 * - 最终避免连续3题同维度或同场景。
 */
export function selectDongDongZouQuestions(
  bank: Question[],
  requestedCount = 100,
  seed = Date.now(),
  recentQuestionIds: string[] = [],
): Question[] {
  const count = clampQuestionCount(requestedCount);
  const random = mulberry32(seed);
  const recent = new Set(recentQuestionIds);
  const targets = domainTargets(count, seed);

  const selected: Question[] = [];
  const selectedIds = new Set<string>();
  const selectedMirrorGroups = new Set<string>();

  for (const axis of AXES) {
    for (const domain of DOMAINS) {
      const stratumKey = `${axis}-${domain}`;
      const stratumTarget = targets.get(stratumKey) ?? 0;

      const stratum = bank.filter(
        (q) =>
          q.isActive &&
          q.bankVersion === "2.0.0" &&
          q.axis === axis &&
          q.domain === domain,
      );

      const traitIds = [...new Set(stratum.map((q) => q.traitId))].sort();
      const traitTargets = distribute(
        stratumTarget,
        traitIds,
        Math.abs(seed + axis.charCodeAt(0) + domain.length) % traitIds.length,
      );

      for (const traitId of shuffle(traitIds, random)) {
        const target = traitTargets.get(traitId) ?? 0;
        const traitPool = shuffle(
          stratum.filter((q) => q.traitId === traitId),
          random,
        );

        const preferred = [
          ...traitPool.filter((q) => !recent.has(q.id)),
          ...traitPool.filter((q) => recent.has(q.id)),
        ];

        let added = 0;
        for (const q of preferred) {
          if (added >= target) break;
          if (selectedIds.has(q.id)) continue;
          if (selectedMirrorGroups.has(q.mirrorGroup)) continue;

          selected.push(q);
          selectedIds.add(q.id);
          selectedMirrorGroups.add(q.mirrorGroup);
          added += 1;
        }

        if (added !== target) {
          throw new Error(
            `Unable to satisfy target for ${stratumKey}/${traitId}: ${added}/${target}`,
          );
        }
      }
    }
  }

  if (selected.length !== count) {
    throw new Error(`Selection count mismatch: ${selected.length}/${count}`);
  }

  return reorderWithRunLimits(selected, random);
}

export function validateDongDongZouBank(bank: Question[]): void {
  const errors: string[] = [];

  if (bank.length !== 640) {
    errors.push(`Expected 640 questions, received ${bank.length}.`);
  }

  const ids = new Set<string>();
  const axisCounts = new Map<string, number>();
  const domainCounts = new Map<string, number>();
  const traitCounts = new Map<string, number>();

  for (const q of bank) {
    if (ids.has(q.id)) errors.push(`Duplicate id: ${q.id}`);
    ids.add(q.id);

    if (q.bankVersion !== "2.0.0") {
      errors.push(`${q.id}: wrong bankVersion ${q.bankVersion}`);
    }
    if (q.timeoutMs !== 12000) {
      errors.push(`${q.id}: timeoutMs must be 12000`);
    }
    if (q.options.length !== 3) {
      errors.push(`${q.id}: expected exactly 3 options`);
    }
    if (q.readingLength > 48) {
      errors.push(`${q.id}: prompt too long (${q.readingLength})`);
    }

    axisCounts.set(q.axis, (axisCounts.get(q.axis) ?? 0) + 1);
    domainCounts.set(q.domain, (domainCounts.get(q.domain) ?? 0) + 1);
    traitCounts.set(q.traitId, (traitCounts.get(q.traitId) ?? 0) + 1);
  }

  for (const axis of AXES) {
    if (axisCounts.get(axis) !== 160) {
      errors.push(`${axis}: expected 160 questions`);
    }
  }
  if (domainCounts.get("life") !== 320) errors.push("life: expected 320 questions");
  if (domainCounts.get("relationship") !== 320) {
    errors.push("relationship: expected 320 questions");
  }
  for (const [traitId, traitCount] of traitCounts) {
    if (traitCount !== 20) {
      errors.push(`${traitId}: expected 20 questions, received ${traitCount}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`DONGDONGZOU question bank validation failed:\n${errors.join("\n")}`);
  }
}
