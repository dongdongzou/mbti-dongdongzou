import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { selectDongDongZouQuestions, validateDongDongZouBank } from "../lib/dongdongzouQuestionBankSelector.ts";

const BANK_PATH = "lib/data/DONGDONGZOU_MBTI_QUESTION_BANK_640_v2.json";
const EXPECTED_SHA256 = "f662c020ca3b073807334fac834d317688f30b38991c26979e31c29ca95c7447";
const raw = await readFile(BANK_PATH);
const bank = JSON.parse(raw.toString("utf8"));
const questions = bank.questions;
const axes = ["EI", "SN", "TF", "JP"];
const domains = ["life", "relationship"];
const errors = [];

function countBy(items, key) {
  return Object.fromEntries([...new Set(items.map((item) => item[key]))].sort().map((value) => [value, items.filter((item) => item[key] === value).length]));
}

function maxRun(items, key) {
  let maximum = 0;
  let current = 0;
  let previous;
  for (const item of items) {
    current = item[key] === previous ? current + 1 : 1;
    previous = item[key];
    maximum = Math.max(maximum, current);
  }
  return maximum;
}

const sha256 = createHash("sha256").update(raw).digest("hex");
if (sha256 !== EXPECTED_SHA256) errors.push(`SHA-256 不一致：${sha256}`);
if (bank.meta.version !== "2.0.0") errors.push(`题库版本应为 2.0.0，实际 ${bank.meta.version}`);
if (questions.length !== 640) errors.push(`总题数应为 640，实际 ${questions.length}`);
if (questions[0]?.id !== "DDZ-Q0001" || questions.at(-1)?.id !== "DDZ-Q0640") errors.push("首尾题目 ID 不正确");

try {
  validateDongDongZouBank(questions);
} catch (error) {
  errors.push(error instanceof Error ? error.message : String(error));
}

const ids = new Set();
const prompts = new Set();
for (const question of questions) {
  if (ids.has(question.id)) errors.push(`重复题目 ID：${question.id}`);
  if (prompts.has(question.prompt)) errors.push(`重复题干：${question.id}`);
  ids.add(question.id);
  prompts.add(question.prompt);
  for (const field of ["bankVersion", "axis", "domain", "traitId", "traitName", "targetPole", "responseType", "responseGuide", "mirrorGroup", "scenarioTag", "readingLength", "estimatedReadingMs", "timeoutMs", "weight"]) {
    if (question[field] === undefined || question[field] === "") errors.push(`${question.id} 缺少 ${field}`);
  }
  if (question.bankVersion !== "2.0.0") errors.push(`${question.id} 版本错误`);
  if (!question.isActive || !question.isOriginal) errors.push(`${question.id} 必须是启用的原创题`);
  if (question.timeoutMs !== 12000) errors.push(`${question.id} 超时应为 12000ms`);
  if (question.prompt.length > 48 || question.readingLength !== question.prompt.length) errors.push(`${question.id} 题干长度错误`);
  if (question.options.length !== 3) errors.push(`${question.id} 必须有三个选项`);
  const axisScores = question.options.map((option) => option.axisScore).sort((a, b) => a - b).join(",");
  const traitScores = question.options.map((option) => option.traitScore).sort((a, b) => a - b).join(",");
  if (axisScores !== "-2,0,2" || traitScores !== "-2,0,2") errors.push(`${question.id} 显式分数不完整`);
  if (question.options.some((option) => !option.id || !option.label || option.axisScore === undefined || option.traitScore === undefined)) errors.push(`${question.id} 选项字段缺失`);
}

const axisCounts = countBy(questions, "axis");
const domainCounts = countBy(questions, "domain");
const traitCounts = countBy(questions, "traitId");
const typeCounts = countBy(questions, "responseType");
const mirrorCounts = countBy(questions, "mirrorGroup");
for (const axis of axes) if (axisCounts[axis] !== 160) errors.push(`${axis} 应为 160，实际 ${axisCounts[axis]}`);
for (const domain of domains) if (domainCounts[domain] !== 320) errors.push(`${domain} 应为 320，实际 ${domainCounts[domain]}`);
for (const axis of axes) for (const domain of domains) {
  const count = questions.filter((question) => question.axis === axis && question.domain === domain).length;
  if (count !== 80) errors.push(`${axis}-${domain} 应为 80，实际 ${count}`);
}
if (Object.keys(traitCounts).length !== 32 || Object.values(traitCounts).some((count) => count !== 20)) errors.push("32 项行为特质必须各 20 题");
if (typeCounts.selfMatch !== 448 || typeCounts.frequency !== 128 || typeCounts.directional !== 64) errors.push(`答案模板比例错误：${JSON.stringify(typeCounts)}`);
if (Object.keys(mirrorCounts).length !== 160 || Object.values(mirrorCounts).some((count) => count !== 4)) errors.push("镜像组必须为 160 组且每组 4 题");

const simulations = [];
for (const count of [80, 100, 120]) {
  for (const seed of [1, 2, 37, 20260715]) {
    const selected = selectDongDongZouQuestions(questions, count, seed, []);
    const selectedAxes = countBy(selected, "axis");
    const selectedDomains = countBy(selected, "domain");
    if (selected.length !== count) errors.push(`${count} 题 seed ${seed} 数量错误`);
    if (axes.some((axis) => selectedAxes[axis] !== count / 4)) errors.push(`${count} 题 seed ${seed} 四轴不平衡`);
    if (selectedDomains.life !== count / 2 || selectedDomains.relationship !== count / 2) errors.push(`${count} 题 seed ${seed} 场景不平衡`);
    if (new Set(selected.map((question) => question.mirrorGroup)).size !== count) errors.push(`${count} 题 seed ${seed} 镜像组重复`);
    if (Object.keys(countBy(selected, "traitId")).length !== 32) errors.push(`${count} 题 seed ${seed} 未覆盖 32 项特质`);
    if (maxRun(selected, "axis") > 2 || maxRun(selected, "domain") > 2) errors.push(`${count} 题 seed ${seed} 出现连续三题同维度或场景`);
    if (seed === 20260715) simulations.push({ count, axes: selectedAxes, domains: selectedDomains, traits: Object.keys(countBy(selected, "traitId")).length, mirrorGroups: new Set(selected.map((question) => question.mirrorGroup)).size });
  }
}

const lengths = questions.map((question) => question.prompt.length);
console.log("\nDONGDONGZOU v2 题库校验");
console.log(`- 运行文件：${BANK_PATH}`);
console.log(`- 版本：${bank.meta.version}`);
console.log(`- SHA-256：${sha256}`);
console.log(`- 首题 / 末题：${questions[0].id} / ${questions.at(-1).id}`);
console.log(`- 总题数：${questions.length}`);
console.log(`- 维度：${JSON.stringify(axisCounts)}`);
console.log(`- 场景：${JSON.stringify(domainCounts)}`);
console.log(`- 行为特质：${Object.keys(traitCounts).length} 项，每项 ${Math.min(...Object.values(traitCounts))}–${Math.max(...Object.values(traitCounts))} 题`);
console.log(`- 答案模板：${JSON.stringify(typeCounts)}`);
console.log(`- 题干平均 / 最长：${(lengths.reduce((sum, value) => sum + value, 0) / lengths.length).toFixed(2)} / ${Math.max(...lengths)}`);
for (const simulation of simulations) console.log(`- ${simulation.count} 题模拟：${JSON.stringify(simulation)}`);

if (errors.length) {
  console.error("\n校验失败：");
  errors.slice(0, 50).forEach((error) => console.error(`- ${error}`));
  if (errors.length > 50) console.error(`- 其余 ${errors.length - 50} 项已省略`);
  process.exitCode = 1;
} else {
  console.log("\n校验通过。旧题库未参与运行。\n");
}
