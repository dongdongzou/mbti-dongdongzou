import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { selectDongDongZouQuestions } from "../lib/dongdongzouQuestionBankSelector.ts";
import { composeReport } from "../lib/reportComposer.ts";
import { computeSessionResult } from "../lib/scoring.ts";

const bankUrl = new URL("../lib/data/DONGDONGZOU_MBTI_QUESTION_BANK_640_v2.json", import.meta.url);
const bankRaw = await readFile(bankUrl);
const bank = JSON.parse(bankRaw.toString("utf8"));
const questions = bank.questions;

function counts(items, key) {
  return Object.fromEntries([...new Set(items.map((item) => item[key]))].sort().map((value) => [value, items.filter((item) => item[key] === value).length]));
}

function response(question, option, elapsedMs = 3000) {
  return {
    questionId: question.id,
    selectedOptionId: option?.id ?? null,
    axisScore: option?.axisScore ?? null,
    traitScore: option?.traitScore ?? null,
    elapsedMs,
    timedOut: !option,
    bankVersion: "2.0.0",
    answeredAt: new Date().toISOString(),
  };
}

test("只加载 SHA-256 一致的 DONGDONGZOU v2 正式题库", () => {
  assert.equal(createHash("sha256").update(bankRaw).digest("hex"), "2b17486a06d7639a877dcf16c23dee46b9a94efe000ddc7a373deb220045ace3");
  assert.equal(bank.meta.version, "2.0.0");
  assert.equal(questions.length, 640);
  assert.equal(questions[0].id, "DDZ-Q0001");
  assert.equal(questions.at(-1).id, "DDZ-Q0640");
  assert.ok(questions.every((question) => question.bankVersion === "2.0.0" && question.isActive));
});

test("640 题严格保持四轴、场景、32 特质和三类回答分布", () => {
  assert.deepEqual(counts(questions, "axis"), { EI: 160, JP: 160, SN: 160, TF: 160 });
  assert.deepEqual(counts(questions, "domain"), { life: 320, relationship: 320 });
  assert.equal(Object.keys(counts(questions, "traitId")).length, 32);
  assert.ok(Object.values(counts(questions, "traitId")).every((value) => value === 20));
  assert.deepEqual(counts(questions, "responseType"), { directional: 64, frequency: 128, selfMatch: 448 });
  assert.equal(Object.keys(counts(questions, "mirrorGroup")).length, 160);
  assert.ok(Object.values(counts(questions, "mirrorGroup")).every((value) => value === 4));
});

test("题干唯一、最长不超过 48 字，并包含交付包中的生活化新题", () => {
  assert.equal(new Set(questions.map((question) => question.prompt)).size, 640);
  assert.ok(questions.every((question) => question.prompt.length <= 48 && question.readingLength === question.prompt.length));
  assert.equal(Math.max(...questions.map((question) => question.prompt.length)), 37);
  assert.ok(questions.some((question) => question.prompt === "当准备一次三到五天的旅行时，我会提前确定住宿、路线和大致时间。"));
  assert.ok(questions.some((question) => question.prompt === "当对方情绪低落但还没准备好解释时，我会先陪着他而不是追问答案。"));
  assert.ok(questions.some((question) => question.prompt === "当参加一个几乎没有熟人的聚会时，我会先找一个看起来好接近的人聊起来。"));
});

test("三类问题使用 JSON 内的引导与显式双分数", () => {
  assert.ok(questions.filter((question) => question.responseType === "selfMatch").every((question) => question.responseGuide === "这有多像你平时真实的状态？"));
  assert.ok(questions.filter((question) => question.responseType === "frequency").every((question) => question.responseGuide === "这种情况通常会发生吗？"));
  for (const question of questions) {
    assert.deepEqual(question.options.map((option) => option.axisScore).sort((a, b) => a - b), [-2, 0, 2]);
    assert.deepEqual(question.options.map((option) => option.traitScore).sort((a, b) => a - b), [-2, 0, 2]);
  }
  assert.ok(questions.filter((question) => question.responseType === "directional").every((question) => question.responseGuide && question.options.every((option) => option.label.length > 1)));
});

for (const count of [80, 100, 120]) {
  test(`${count} 题在多个 seed 下保持分层平衡、32 特质覆盖和镜像唯一`, () => {
    for (const seed of [1, 2, 37, 20260715]) {
      const selected = selectDongDongZouQuestions(questions, count, seed, []);
      assert.equal(selected.length, count);
      assert.deepEqual(Object.values(counts(selected, "axis")), [count / 4, count / 4, count / 4, count / 4]);
      assert.deepEqual(counts(selected, "domain"), { life: count / 2, relationship: count / 2 });
      assert.equal(Object.keys(counts(selected, "traitId")).length, 32);
      assert.equal(new Set(selected.map((question) => question.mirrorGroup)).size, count);
      for (let index = 2; index < selected.length; index += 1) {
        assert.ok(!(selected[index].axis === selected[index - 1].axis && selected[index].axis === selected[index - 2].axis));
        assert.ok(!(selected[index].domain === selected[index - 1].domain && selected[index].domain === selected[index - 2].domain));
      }
    }
  });
}

test("计分只读取选项 axisScore 与 traitScore，不根据 A/B/C 位置推断", () => {
  const forward = questions.find((question) => !question.reverseScored && question.options[0].traitScore === 2);
  const reverse = questions.find((question) => question.reverseScored && question.options[0].traitScore === -2);
  const positiveFirst = questions.find((question) => question.responseType === "directional" && question.options[0].axisScore === 2);
  const negativeFirst = questions.find((question) => question.responseType === "directional" && question.options[0].axisScore === -2);
  assert.ok(forward && reverse && positiveFirst && negativeFirst);
  const forwardResult = computeSessionResult("forward", [forward], [response(forward, forward.options.find((option) => option.traitScore === 2))]);
  const reverseResult = computeSessionResult("reverse", [reverse], [response(reverse, reverse.options.find((option) => option.traitScore === 2))]);
  assert.equal(forwardResult.facetScores[forward.traitId], 100);
  assert.equal(reverseResult.facetScores[reverse.traitId], 100);
  assert.equal(computeSessionResult("positive", [positiveFirst], [response(positiveFirst, positiveFirst.options[0])]).axes[positiveFirst.axis].rightPercent, 100);
  assert.equal(computeSessionResult("negative", [negativeFirst], [response(negativeFirst, negativeFirst.options[0])]).axes[negativeFirst.axis].rightPercent, 0);
});

test("8 秒超时不计为中立答案", () => {
  const question = questions[0];
  const result = computeSessionResult("timeout", [question], [response(question, undefined, 8000)]);
  assert.equal(question.timeoutMs, 8000);
  assert.equal(result.answeredCount, 0);
  assert.equal(result.completionRate, 0);
  assert.equal(result.axes[question.axis].timedOut, 1);
});

test("50–54% 使用接近中线语气，跨域差值达到 12 时生成场景切换", () => {
  const base = questions.find((question) => question.axis === "EI");
  const batch = Array.from({ length: 100 }, (_, index) => ({ ...base, id: `boundary-${index}`, mirrorGroup: `boundary-${index}` }));
  const responses = batch.map((question, index) => ({ ...response(question, question.options[1]), selectedOptionId: index < 52 ? "A" : "C", axisScore: index < 52 ? 2 : -2, traitScore: index < 52 ? 2 : -2 }));
  const result = computeSessionResult("boundary", batch, responses);
  result.domainAxes.life.EI.rightPercent = 50;
  result.domainAxes.relationship.EI.rightPercent = 70;
  const report = composeReport(result, [result]);
  assert.equal(result.axes.EI.boundaryLabel, "near-boundary");
  assert.equal(report.axes.find((axis) => axis.axis === "EI").strengthLabel, "接近中线");
  assert.ok(report.gaps.some((gap) => gap.axis === "EI"));
});

test("新版会话保存 2.0.0，单次和三次报告标签正确", () => {
  const selected = selectDongDongZouQuestions(questions, 80, 1, []);
  const result = computeSessionResult("runs", selected, selected.map((question) => response(question, question.options[1], 3200)));
  assert.equal(result.bankVersion, "2.0.0");
  assert.equal(composeReport(result, [result]).runValidation.label, "初步画像");
  assert.equal(composeReport(result, [result, result, result]).runValidation.label, "稳定画像");
});

test("运行时代码只导入新版题库并让旧的未完成会话失效", async () => {
  const source = await readFile(new URL("../app/InnerCompassApp.tsx", import.meta.url), "utf8");
  assert.match(source, /DONGDONGZOU_MBTI_QUESTION_BANK_640_v2\.json/);
  assert.match(source, /const STORE_KEY = "dongdongzou-mbti-v2"/);
  assert.match(source, /status: "abandoned" as const, invalidatedReason: "question-bank-upgraded"/);
  assert.doesNotMatch(source, /question_bank_640\.json|question_id_map_v2_to_v3/);
  assert.match(source, /axisScore: option\?\.axisScore/);
  assert.match(source, /traitScore: option\?\.traitScore/);
  assert.match(source, /question\.responseGuide/);
});
