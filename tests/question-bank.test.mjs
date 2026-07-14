import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { composeReport } from "../lib/reportComposer.ts";
import { computeSessionResult, selectQuestions } from "../lib/scoring.ts";

const bank = JSON.parse(await readFile(new URL("../lib/data/question_bank_640.json", import.meta.url), "utf8"));
const questions = bank.questions;
const config = JSON.parse(await readFile(new URL("../lib/data/test_config.json", import.meta.url), "utf8"));

function counts(items, key) {
  return Object.fromEntries([...new Set(items.map((item) => item[key]))].map((value) => [value, items.filter((item) => item[key] === value).length]));
}

test("题库 v3 保持 640 题、32 特质与三类答案比例", () => {
  assert.equal(bank.meta.version, "3.0.0");
  assert.equal(questions.length, 640);
  assert.deepEqual(counts(questions, "axis"), { EI: 160, SN: 160, TF: 160, JP: 160 });
  assert.deepEqual(counts(questions, "domain"), { life: 320, relationship: 320 });
  assert.equal(Object.keys(counts(questions, "facetId")).length, 32);
  assert.ok(Object.values(counts(questions, "facetId")).every((value) => value === 20));
  assert.deepEqual(counts(questions, "responseType"), { selfMatch: 448, frequency: 128, directional: 64 });
  assert.ok(questions.every((question) => question.prompt.length >= 16 && question.prompt.length <= 48));
});

for (const count of [80, 100, 120]) {
  test(`${count} 题抽样保持四轴、场景、特质和答案模板平衡`, () => {
    const selected = selectQuestions(questions, count, [], 20260714);
    const axisCounts = counts(selected, "axis");
    const domainCounts = counts(selected, "domain");
    const responseCounts = counts(selected, "responseType");
    assert.equal(selected.length, count);
    assert.equal(new Set(selected.map((question) => question.mirrorGroup)).size, count);
    assert.equal(Object.keys(counts(selected, "facetId")).length, 32);
    assert.deepEqual(Object.values(axisCounts), [count / 4, count / 4, count / 4, count / 4]);
    assert.equal(domainCounts.life, count / 2);
    assert.equal(domainCounts.relationship, count / 2);
    assert.equal(responseCounts.selfMatch, Math.round(count * 0.7));
    assert.equal(responseCounts.frequency, Math.round(count * 0.2));
    assert.equal(responseCounts.directional, count - responseCounts.selfMatch - responseCounts.frequency);
    for (let index = 2; index < selected.length; index += 1) {
      assert.ok(!(selected[index].axis === selected[index - 1].axis && selected[index].axis === selected[index - 2].axis));
      assert.ok(!(selected[index].domain === selected[index - 1].domain && selected[index].domain === selected[index - 2].domain));
    }
  });
}

test("分数来自选项数据，反向题与按钮位置均可正确计分", () => {
  const forward = questions.find((question) => !question.reverseScored && question.responseType === "selfMatch");
  const reverse = questions.find((question) => question.reverseScored && question.responseType === "selfMatch");
  const directionalPositiveFirst = questions.find((question) => question.responseType === "directional" && question.options[0].score === 2);
  const directionalNegativeFirst = questions.find((question) => question.responseType === "directional" && question.options[0].score === -2);
  assert.ok(forward && reverse && directionalPositiveFirst && directionalNegativeFirst);
  const result = computeSessionResult("score", [forward, reverse], [
    { questionId: forward.id, selectedOptionId: forward.options[0].id, score: forward.options[0].score, elapsedMs: 3000, timedOut: false, answeredAt: new Date().toISOString() },
    { questionId: reverse.id, selectedOptionId: reverse.options[0].id, score: reverse.options[0].score, elapsedMs: 3000, timedOut: false, answeredAt: new Date().toISOString() },
  ]);
  assert.equal(result.facetScores[forward.facetId], 100);
  assert.equal(result.facetScores[reverse.facetId], 100);
});

test("超时不计为中立答案，8 秒配置保持不变", () => {
  const question = questions[0];
  const result = computeSessionResult("timeout", [question], [
    { questionId: question.id, selectedOptionId: null, score: null, elapsedMs: 8000, timedOut: true, answeredAt: new Date().toISOString() },
  ]);
  assert.equal(config.session.questionTimeoutMs, 8000);
  assert.equal(result.answeredCount, 0);
  assert.equal(result.completionRate, 0);
  assert.equal(result.axes[question.axis].timedOut, 1);
});

test("50–54% 使用接近中线语气，跨域差值达到 12 时生成场景切换", () => {
  const base = questions.find((question) => question.axis === "EI");
  const batch = Array.from({ length: 100 }, (_, index) => ({ ...base, id: `boundary-${index}`, mirrorGroup: `boundary-${index}` }));
  const responses = batch.map((question, index) => ({
    questionId: question.id,
    selectedOptionId: index < 52 ? "positive" : "negative",
    score: index < 52 ? 2 : -2,
    elapsedMs: 3000,
    timedOut: false,
    answeredAt: new Date().toISOString(),
  }));
  const result = computeSessionResult("boundary", batch, responses);
  result.domainAxes.life.EI.rightPercent = 50;
  result.domainAxes.relationship.EI.rightPercent = 70;
  const report = composeReport(result, [result]);
  assert.equal(result.axes.EI.boundaryLabel, "near-boundary");
  assert.equal(report.axes.find((axis) => axis.axis === "EI").strengthLabel, "接近中线");
  assert.ok(report.gaps.some((gap) => gap.axis === "EI"));
});

test("单次为初步画像，三次后显示稳定画像并保留题库版本", () => {
  const selected = selectQuestions(questions, 80, [], 1);
  const responses = selected.map((question) => ({
    questionId: question.id,
    selectedOptionId: question.options[1].id,
    score: question.options[1].score,
    elapsedMs: 3200,
    timedOut: false,
    answeredAt: new Date().toISOString(),
  }));
  const result = computeSessionResult("runs", selected, responses);
  assert.equal(result.bankVersion, "3.0.0");
  assert.equal(composeReport(result, [result]).runValidation.label, "初步画像");
  assert.equal(composeReport(result, [result, result, result]).runValidation.label, "稳定画像");
});
