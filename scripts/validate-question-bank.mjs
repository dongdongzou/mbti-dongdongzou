import { readFile } from "node:fs/promises";
import { selectQuestions } from "../lib/scoring.ts";

const bank = JSON.parse(await readFile("lib/data/question_bank_640.json", "utf8"));
const questions = bank.questions;
const axes = ["EI", "SN", "TF", "JP"];
const domains = ["life", "relationship"];
const responseTypes = ["selfMatch", "frequency", "directional"];
const bannedTerms = ["价值一致性", "信息加工模式", "认知偏好", "长期图景", "关系影响权重", "内部判断系统", "外部刺激反馈", "结构化闭环倾向"];
const errors = [];

function countBy(items, key) {
  return Object.fromEntries([...new Set(items.map((item) => item[key]))].sort().map((value) => [value, items.filter((item) => item[key] === value).length]));
}

function bigrams(text) {
  const normalized = text.replace(/[，。：“”？、；「」\s]/g, "").replace(/当|在|时|我会|我通常|更接近哪一种反应/g, "");
  const result = new Set();
  for (let index = 0; index < normalized.length - 1; index += 1) result.add(normalized.slice(index, index + 2));
  return result;
}

function similarity(a, b) {
  const left = bigrams(a);
  const right = bigrams(b);
  const intersection = [...left].filter((item) => right.has(item)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

if (questions.length !== 640) errors.push(`总题数应为 640，实际 ${questions.length}`);
const ids = new Set();
for (const question of questions) {
  if (ids.has(question.id)) errors.push(`重复题目 ID：${question.id}`);
  ids.add(question.id);
  for (const field of ["version", "axis", "domain", "facetId", "facetName", "responseType", "mirrorGroup", "scenarioTag", "readingLength", "estimatedReadingMs", "weight"]) {
    if (question[field] === undefined || question[field] === "") errors.push(`${question.id} 缺少 ${field}`);
  }
  if (question.prompt.length < 16) errors.push(`${question.id} 少于 16 字`);
  if (question.prompt.length > 48) errors.push(`${question.id} 超过 48 字（${question.prompt.length}）`);
  if (question.readingLength !== question.prompt.length) errors.push(`${question.id} readingLength 不一致`);
  const banned = bannedTerms.find((term) => question.prompt.includes(term));
  if (banned) errors.push(`${question.id} 含禁用词：${banned}`);
  if (/不.{0,5}(不|没|无)/.test(question.prompt)) errors.push(`${question.id} 疑似双重否定`);
  if (!/^(当|在)/.test(question.prompt)) errors.push(`${question.id} 缺少具体场景句式`);
  if (!responseTypes.includes(question.responseType)) errors.push(`${question.id} responseType 无效`);
  const scores = question.options.map((option) => option.score).sort((a, b) => a - b).join(",");
  if (question.options.length !== 3 || scores !== "-2,0,2") errors.push(`${question.id} 选项分数不完整：${scores}`);
  if (question.options.some((option) => !option.id || !option.label)) errors.push(`${question.id} 选项缺少 id 或 label`);
}

const axisCounts = countBy(questions, "axis");
const domainCounts = countBy(questions, "domain");
const facetCounts = countBy(questions, "facetId");
const typeCounts = countBy(questions, "responseType");
for (const axis of axes) if (axisCounts[axis] !== 160) errors.push(`${axis} 应为 160，实际 ${axisCounts[axis]}`);
for (const domain of domains) if (domainCounts[domain] !== 320) errors.push(`${domain} 应为 320，实际 ${domainCounts[domain]}`);
for (const [facet, count] of Object.entries(facetCounts)) if (count !== 20) errors.push(`${facet} 应为 20，实际 ${count}`);
if (Object.keys(facetCounts).length !== 32) errors.push(`行为特质应为 32，实际 ${Object.keys(facetCounts).length}`);
if (typeCounts.selfMatch !== 448 || typeCounts.frequency !== 128 || typeCounts.directional !== 64) errors.push(`答案模板比例错误：${JSON.stringify(typeCounts)}`);

const duplicates = [];
for (let leftIndex = 0; leftIndex < questions.length; leftIndex += 1) {
  for (let rightIndex = leftIndex + 1; rightIndex < questions.length; rightIndex += 1) {
    const left = questions[leftIndex];
    const right = questions[rightIndex];
    if (left.mirrorGroup === right.mirrorGroup || left.axis !== right.axis || left.domain !== right.domain) continue;
    const score = similarity(left.prompt, right.prompt);
    if (score >= 0.9) duplicates.push({ left: left.id, right: right.id, score: Number(score.toFixed(2)) });
  }
}
if (duplicates.length) errors.push(`发现 ${duplicates.length} 组非镜像高相似题`);

function simulate(count, seed) {
  const selected = selectQuestions(questions, count, [], seed);
  return {
    count: selected.length,
    axes: countBy(selected, "axis"),
    domains: countBy(selected, "domain"),
    traits: Object.keys(countBy(selected, "facetId")).length,
    responseTypes: countBy(selected, "responseType"),
    reversePercent: Number((selected.filter((question) => question.reverseScored).length / selected.length * 100).toFixed(1)),
  };
}

const lengths = questions.map((question) => question.prompt.length);
const simulations = [80, 100, 120].map((count) => simulate(count, 20260714));
const reversePercent = Number((questions.filter((question) => question.reverseScored).length / questions.length * 100).toFixed(1));

console.log("\nInnerCompass 题库校验");
console.log(`- 版本：${bank.meta.version}`);
console.log(`- 总题数：${questions.length}`);
console.log(`- 维度：${JSON.stringify(axisCounts)}`);
console.log(`- 场景：${JSON.stringify(domainCounts)}`);
console.log(`- 行为特质：${Object.keys(facetCounts).length} 项，每项 ${Math.min(...Object.values(facetCounts))}–${Math.max(...Object.values(facetCounts))} 题`);
console.log(`- 答案模板：${JSON.stringify(typeCounts)}`);
console.log(`- 平均字数：${(lengths.reduce((sum, value) => sum + value, 0) / lengths.length).toFixed(1)}`);
console.log(`- 最短 / 最长：${Math.min(...lengths)} / ${Math.max(...lengths)}`);
console.log(`- 反向题占比：${reversePercent}%`);
console.log(`- 超长题：${questions.filter((question) => question.prompt.length > 48).length}`);
console.log(`- 高相似题：${duplicates.length}`);
for (const result of simulations) console.log(`- ${result.count} 题模拟：${JSON.stringify(result)}`);

if (errors.length) {
  console.error("\n校验失败：");
  errors.slice(0, 40).forEach((error) => console.error(`- ${error}`));
  if (errors.length > 40) console.error(`- 其余 ${errors.length - 40} 项已省略`);
  process.exitCode = 1;
} else {
  console.log("\n校验通过。\n");
}
