import { readFile, writeFile } from "node:fs/promises";

const BANK_PATH = "lib/data/DONGDONGZOU_MBTI_QUESTION_BANK_640_v2.json";
const VERSION = "2.1.0";
const RESPONSE_GUIDE = "先选更像你的反应；只有两种反应同样常见时，再选中间。";
const MIDDLE_LABEL = "两种都差不多";

const promptPatterns = [
  (scenario) => `想象这个场景：${scenario}。你通常会怎么做？`,
  (scenario) => `回想真实经历：${scenario}。哪种反应更像你？`,
  (scenario) => `遇到这种情况：${scenario}。你的第一反应是哪种？`,
  (scenario) => `场景：${scenario}。你平时更常怎么做？`,
];

function behaviorFromPrompt(question) {
  const { prompt, scenarioTag } = question;
  const prefixes = [
    `当${scenarioTag}时，`,
    `在${scenarioTag}时，`,
    `当${scenarioTag}，`,
    `在${scenarioTag}，`,
    `${scenarioTag}，`,
  ];
  const prefix = prefixes.find((candidate) => prompt.startsWith(candidate));
  if (!prefix) {
    throw new Error(`${question.id} 无法从题干中拆分场景与行为：${prompt}`);
  }
  return prompt
    .slice(prefix.length)
    .replace(/^我/, "")
    .replace(/[。？]$/, "");
}

function behaviorSides(group) {
  const directional = group.find((question) => question.responseType === "directional");
  if (directional) {
    return Object.fromEntries(
      directional.options
        .filter((option) => option.axisScore !== 0)
        .map((option) => [option.axisScore, option.label]),
    );
  }

  const sides = {};
  for (const question of group) {
    const promptScore = question.options.find((option) => option.id === "A")?.axisScore;
    if (promptScore !== -2 && promptScore !== 2) {
      throw new Error(`${question.id} 的原题 A 选项没有明确方向`);
    }
    sides[promptScore] ??= behaviorFromPrompt(question);
  }
  return sides;
}

const raw = await readFile(BANK_PATH, "utf8");
const bank = JSON.parse(raw);
const groups = new Map();

for (const question of bank.questions) {
  const group = groups.get(question.mirrorGroup) ?? [];
  group.push(question);
  groups.set(question.mirrorGroup, group);
}

for (const [mirrorGroup, group] of groups) {
  if (group.length !== 4) throw new Error(`${mirrorGroup} 应包含 4 道镜像题`);
  const sides = behaviorSides(group);
  if (!sides[-2] || !sides[2] || sides[-2] === sides[2]) {
    throw new Error(`${mirrorGroup} 无法生成清晰的对立选项`);
  }

  group.forEach((question, index) => {
    question.bankVersion = VERSION;
    question.responseType = "directional";
    question.responseGuide = RESPONSE_GUIDE;
    question.prompt = promptPatterns[index](question.scenarioTag);
    question.readingLength = question.prompt.length;
    question.estimatedReadingMs = Math.round((question.readingLength / 7.5) * 1000);
    question.options = question.options.map((option) => ({
      ...option,
      label: option.axisScore === 0 ? MIDDLE_LABEL : sides[option.axisScore],
    }));
  });
}

bank.meta.name = "DONGDONGZOU MBTI 生活与感情原创对比情境题库";
bank.meta.version = VERSION;
bank.meta.responseTypes = { directional: bank.questions.length };
bank.meta.uxRevision = "场景与问题分层呈现；三个选项改为两种具体反应加一个严格中间项";
bank.meta.replacementPolicy = `本文件是 ${VERSION} 唯一题库数据源。项目不得回退或合并旧题库。`;

await writeFile(BANK_PATH, `${JSON.stringify(bank, null, 2)}\n`, "utf8");
console.log(`已将 ${bank.questions.length} 道题转换为清晰的场景对比题，版本 ${VERSION}。`);
