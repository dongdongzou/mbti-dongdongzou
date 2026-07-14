import type { Pole, Question, QuestionOption } from "./schemas";

function behaviorStatement(question: Question, behavior: string): string {
  const context = question.prompt.startsWith("当")
    ? question.prompt.slice(1).replace(/时，你通常更倾向于：$/, "")
    : question.prompt.replace(/。哪种后续状态更接近你？$/, "");
  const cleanBehavior = behavior.replace(/[。；;]$/, "");
  return `面对「${context}」这类情境，我的实际反应通常是：${cleanBehavior}。`;
}

function poleForScore(question: Question, score: -1 | 1): Pole {
  return score === 1 ? question.rightPole : question.leftPole;
}

/**
 * 将 320 道三选一情境题转为 640 道平衡的行为陈述题。
 * 每个原题的两个明确方向各生成一道题，同意/不同意会随陈述方向翻转计分。
 */
export function buildBehaviorQuestionBank(
  source: Question[],
  timeoutMs: number,
): Question[] {
  return source.flatMap((question) =>
    question.options
      .filter((option): option is QuestionOption & { score: -1 | 1 } => option.score !== 0)
      .map((behavior) => {
        const agreeScore = behavior.score;
        const disagreeScore = (agreeScore * -1) as -1 | 1;
        const direction = agreeScore === 1 ? "R" : "L";

        return {
          ...question,
          id: `${question.id}-${direction}`,
          prompt: behaviorStatement(question, behavior.text),
          options: [
            { id: "A", text: "同意", score: agreeScore, pole: poleForScore(question, agreeScore) },
            { id: "B", text: "一般", score: 0, pole: null },
            { id: "C", text: "不同意", score: disagreeScore, pole: poleForScore(question, disagreeScore) },
          ],
          timeoutMs,
        } satisfies Question;
      }),
  );
}
