"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import questionBankJson from "@/lib/data/DONGDONGZOU_MBTI_QUESTION_BANK_640_v2.json";
import profilesJson from "@/lib/data/type_profiles_16.json";
import config from "@/lib/data/test_config.json";
import { composeReport, REQUIRED_DISCLAIMER } from "@/lib/reportComposer";
import { selectDongDongZouQuestions } from "@/lib/dongdongzouQuestionBankSelector";
import { computeSessionResult } from "@/lib/scoring";
import type { Axis, Pole, Question, ResponseRecord, SessionResult } from "@/lib/schemas";

const STORE_KEY = "dongdongzou-mbti-v2";
const LEGACY_STORE_KEY = "innercompass16:v2";
const AXES: Axis[] = ["EI", "SN", "TF", "JP"];
const SCENE_EXAMPLES: Record<Pole, { life: string; relationship: string; social: string }> = {
  E: { life: "空闲时，你更容易通过聊天、活动或外界反馈找回状态。", relationship: "喜欢一个人时，你更可能主动联系和分享近况。", social: "进入陌生聚会时，你更可能先开口认识人。" },
  I: { life: "忙了一天后，你更需要独处和安静来恢复。", relationship: "难受时，你更常先想清楚，再和对方谈。", social: "到陌生场合时，你通常先观察，再慢慢参与。" },
  S: { life: "做决定时，你更看具体信息、步骤和现实条件。", relationship: "你更相信对方持续的行动和已经发生的事实。", social: "听人讲故事时，你更容易记住具体经过和细节。" },
  N: { life: "你容易从零散信息里看到联系和下一步可能。", relationship: "你会留意语气、变化和行为背后的含义。", social: "聊天时，你更容易从一件事联想到更大的主题。" },
  T: { life: "遇到问题时，你先分析原因、规则和有效办法。", relationship: "对方烦恼时，你表达关心的方式常是一起解决问题。", social: "意见不同时，你更重视观点是否一致、有逻辑。" },
  F: { life: "做决定时，你会把他人的感受和关系影响一起算进去。", relationship: "对方难过时，你通常先让对方感到被理解。", social: "意见不同时，你会先调整表达，避免让人被否定。" },
  J: { life: "旅行或任务开始前，明确计划会让你更踏实。", relationship: "你更希望关系方向、承诺和下一步说清楚。", social: "组织活动时，你倾向先确认时间、分工和安排。" },
  P: { life: "计划变化时，你更容易边走边调整。", relationship: "你更愿意让关系自然发展，保留调整空间。", social: "临时邀约或新想法出现时，你更愿意顺势尝试。" },
};
const BANK_VERSION = questionBankJson.meta.version;
const bank = (questionBankJson.questions as unknown as Question[]).filter(
  (question) => question.isActive && question.bankVersion === BANK_VERSION,
);

if (BANK_VERSION !== "2.1.0") throw new Error("Wrong DONGDONGZOU question bank version");
if (questionBankJson.questions.length !== 640 || bank.length !== 640) {
  throw new Error(`Expected 640 active DONGDONGZOU questions, received ${bank.length}`);
}

type TypeProfile = {
  title: string;
  overview: string;
  behaviorLogic: string;
  relationship: string;
  stressPattern: string;
  strengths: string[];
  growth: string[];
};

const profiles = profilesJson as Record<string, TypeProfile>;

type StoredSession = {
  id: string;
  seed: number;
  questionIds: string[];
  currentIndex: number;
  currentQuestionStartedAt: number;
  responses: ResponseRecord[];
  status: "active" | "completed" | "abandoned";
  createdAt: string;
  completedAt?: string;
  result?: SessionResult;
  bankVersion?: string;
  dataVersion: 2 | 3 | 4;
  invalidatedReason?: "question-bank-upgraded";
};

type Store = { version: 3; sessions: StoredSession[] };

const emptyStore = (): Store => ({ version: 3, sessions: [] });

function loadStore(): Store {
  if (typeof window === "undefined") return emptyStore();
  try {
    const currentValue = localStorage.getItem(STORE_KEY);
    const parsed = JSON.parse(currentValue || localStorage.getItem(LEGACY_STORE_KEY) || "null");
    if (!parsed || !Array.isArray(parsed.sessions)) return emptyStore();
    const sessions: StoredSession[] = parsed.sessions.map((session: StoredSession) => {
      if (session.status !== "active" || session.bankVersion === BANK_VERSION) return session;
      return { ...session, status: "abandoned" as const, invalidatedReason: "question-bank-upgraded" as const };
    });
    const migrated: Store = { version: 3, sessions };
    if (!currentValue || parsed.version !== 3 || sessions.some((session, index) => session !== parsed.sessions[index])) {
      localStorage.setItem(STORE_KEY, JSON.stringify(migrated));
    }
    return migrated;
  } catch {
    return emptyStore();
  }
}

function writeStore(store: Store) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

function upsertSession(session: StoredSession) {
  const store = loadStore();
  const index = store.sessions.findIndex((item) => item.id === session.id);
  if (index >= 0) store.sessions[index] = session;
  else store.sessions.unshift(session);
  writeStore(store);
}

function sessionQuestions(session: StoredSession): Question[] {
  const byId = new Map(bank.map((question) => [question.id, question]));
  return session.bankVersion === BANK_VERSION
    ? session.questionIds.map((id) => byId.get(id)).filter(Boolean) as Question[]
    : [];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function Logo() {
  return <span className="logo-mark" aria-hidden="true"><span>✦</span></span>;
}

function Shell({ children, compact = false }: { children: React.ReactNode; compact?: boolean }) {
  return (
    <main className={compact ? "app-shell compact" : "app-shell"}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      {children}
    </main>
  );
}

function TopBar({ onHome, action }: { onHome: () => void; action?: React.ReactNode }) {
  return (
    <header className="topbar">
      <button className="brand-button" onClick={onHome} aria-label="返回首页"><Logo /><span>InnerCompass <b>16</b></span></button>
      {action}
    </header>
  );
}

function AxisBars({ result }: { result: SessionResult }) {
  const axes = result.axes;
  return (
    <div className="axis-list">
      {AXES.map((axis) => {
        const score = axes[axis];
        const near = score.boundaryLabel === "near-boundary";
        return (
          <div className="axis-row" key={axis}>
            <div className="axis-labels"><b>{score.leftPole} {Math.round(score.leftPercent)}%</b><span>{near ? "情境型" : "本次"}</span><b>{Math.round(score.rightPercent)}% {score.rightPole}</b></div>
            <div className="axis-track" aria-label={`${score.leftPole} ${score.leftPercent}%，${score.rightPole} ${score.rightPercent}%`}>
              <span style={{ width: `${score.leftPercent}%` }} />
              <i />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HomeView({ navigate, revision }: { navigate: (path: string) => void; revision: number }) {
  const store = useMemo(() => { void revision; return loadStore(); }, [revision]);
  const active = store.sessions.find((session) => session.status === "active");
  const completed = store.sessions.filter((session) => session.status === "completed");
  const bankUpgradeInvalidatedSession = store.sessions.some((session) => session.invalidatedReason === "question-bank-upgraded");
  return (
    <Shell>
      <TopBar onHome={() => navigate("/")} action={<button className="text-button" onClick={() => navigate("/history")}>历史记录</button>} />
      <section className="hero">
        <div className="hero-kicker"><span /> 原创 · 非官方 · 一次完成</div>
        <h1>更安静地，<br />看见自己的<span>行为偏好</span>。</h1>
        <p className="hero-copy">从生活与关系中的真实场景出发，在两种具体反应中选择更像你的一边，完成一次即可获得完整画像。</p>
        {bankUpgradeInvalidatedSession && <div className="upgrade-notice">题目已升级为更易读的场景对比版。为保证结果准确，旧的未完成测试已失效，请重新开始；历史报告仍会保留。</div>}
        <div className="hero-actions">
          <button className="primary-button" onClick={() => navigate("/setup")}>开始第一次测试 <span>→</span></button>
          {active && <button className="secondary-button" onClick={() => navigate(`/test/${active.id}`)}>继续上次测试 · {active.currentIndex + 1}/{active.questionIds.length}</button>}
          {!active && completed.length > 0 && <button className="secondary-button" onClick={() => navigate(`/run-result/${completed[0].id}`)}>查看最近结果</button>}
        </div>
        <div className="trust-row">
          <span><b>80–120</b> 题</span><i /><span><b>12</b> 秒快速判断</span><i /><span>完成 <b>1</b> 次即可</span>
        </div>
      </section>
      <section className="feature-grid">
        <article><span className="feature-icon">◌</span><h3>情境，而非标签</h3><p>同时观察日常生活与亲密关系中的偏好变化，不用一个字母概括全部的你。</p></article>
        <article><span className="feature-icon">⌁</span><h3>一次完整画像</h3><p>题量覆盖四个偏好维度与生活、关系场景，一次完成即可查看完整结果。</p></article>
        <article><span className="feature-icon">⌂</span><h3>答案只在本机</h3><p>无需注册，数据默认保存在当前设备的浏览器中，也可以随时导出或删除。</p></article>
      </section>
      <footer className="disclaimer">{REQUIRED_DISCLAIMER}</footer>
    </Shell>
  );
}

function SetupView({ navigate }: { navigate: (path: string) => void }) {
  const [count, setCount] = useState(config.session.defaultQuestionCount);
  const start = () => {
    const store = loadStore();
    const recent = store.sessions.filter((session) => session.bankVersion === BANK_VERSION).slice(0, 3).flatMap((session) => session.questionIds);
    const seed = Date.now();
    const selected = selectDongDongZouQuestions(bank, count, seed, recent);
    const session: StoredSession = {
      id: `ic-${seed.toString(36)}`, seed, questionIds: selected.map((question) => question.id),
      currentIndex: 0, currentQuestionStartedAt: Date.now(), responses: [], status: "active",
      createdAt: new Date().toISOString(), bankVersion: BANK_VERSION, dataVersion: 4,
    };
    upsertSession(session);
    navigate(`/test/${session.id}`);
  };
  return (
    <Shell compact>
      <TopBar onHome={() => navigate("/")} action={<button className="text-button" onClick={() => navigate("/")}>取消</button>} />
      <section className="setup-card">
        <div className="step-label">开始前 · 选择本次题量</div>
        <h1>给自己一段<br />不被打扰的时间。</h1>
        <p>每题最多 12 秒。先看场景，再从两种具体反应中选择更像你的一边；只有两边同样常见时才选中间。</p>
        <div className="count-selector" role="radiogroup" aria-label="题目数量">
          {[80, 100, 120].map((value) => <button key={value} role="radio" aria-checked={count === value} className={count === value ? "selected" : ""} onClick={() => setCount(value)}><b>{value}</b><span>题</span>{value === 100 && <em>推荐</em>}</button>)}
        </div>
        <div className="setup-summary">
          <div><span>预计用时</span><b>约 {Math.ceil(count * 8 / 60)}–{Math.ceil(count * 12 / 60)} 分钟</b></div>
          <div><span>场景配比</span><b>生活 50% · 关系 50%</b></div>
          <div><span>计时规则</span><b>每题 12 秒 · 不可返回</b></div>
        </div>
        <button className="primary-button wide" onClick={start}>我准备好了 <span>→</span></button>
        <p className="microcopy">键盘可使用 A / B / C 或 1 / 2 / 3 作答</p>
      </section>
    </Shell>
  );
}

function TestView({ sessionId, navigate }: { sessionId: string; navigate: (path: string) => void }) {
  const [session, setSession] = useState<StoredSession | null>(() => loadStore().sessions.find((item) => item.id === sessionId) || null);
  const [now, setNow] = useState(() => Date.now());
  const [chosen, setChosen] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const sessionRef = useRef(session);
  const lockedRef = useRef(false);
  useEffect(() => { sessionRef.current = session; }, [session]);
  const questions = useMemo(() => session ? sessionQuestions(session) : [], [session]);
  const question = session ? questions[session.currentIndex] : undefined;

  const submit = useCallback((optionId: Question["options"][number]["id"] | null) => {
    const current = sessionRef.current;
    if (!current || current.status !== "active" || lockedRef.current) return;
    const allQuestions = sessionQuestions(current);
    const currentQuestion = allQuestions[current.currentIndex];
    if (!currentQuestion) return;
    lockedRef.current = true;
    setLocked(true);
    setChosen(optionId);
    const option = optionId ? currentQuestion.options.find((item) => item.id === optionId) : undefined;
    const response: ResponseRecord = {
      questionId: currentQuestion.id, selectedOptionId: optionId,
      axisScore: option?.axisScore ?? null, traitScore: option?.traitScore ?? null,
      elapsedMs: Math.min(Date.now() - current.currentQuestionStartedAt, currentQuestion.timeoutMs),
      timedOut: optionId === null, bankVersion: BANK_VERSION, answeredAt: new Date().toISOString(),
    };
    const responses = [...current.responses.filter((item) => item.questionId !== response.questionId), response];
    const finished = current.currentIndex >= allQuestions.length - 1;
    const delay = optionId ? config.session.advanceAfterChoiceMs : 80;
    const next: StoredSession = finished
      ? { ...current, responses, status: "completed", completedAt: new Date().toISOString() }
      : { ...current, responses, currentIndex: current.currentIndex + 1, currentQuestionStartedAt: Date.now() + delay };
    if (finished) next.result = computeSessionResult(next.id, allQuestions, responses);
    upsertSession(next);
    window.setTimeout(() => {
      setChosen(null);
      lockedRef.current = false;
      setLocked(false);
      setSession(next);
      if (finished) navigate(`/run-result/${next.id}`);
    }, delay);
  }, [navigate]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    const onVisibility = () => {
      const current = sessionRef.current;
      if (document.visibilityState === "visible" && current) {
        const currentQuestion = sessionQuestions(current)[current.currentIndex];
        if (currentQuestion && Date.now() - current.currentQuestionStartedAt >= currentQuestion.timeoutMs) submit(null);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisibility); };
  }, [submit]);

  useEffect(() => {
    if (!question || !session || lockedRef.current) return;
    const remaining = question.timeoutMs - (Date.now() - session.currentQuestionStartedAt);
    if (remaining <= 0) { submit(null); return; }
    const timeout = window.setTimeout(() => submit(null), remaining);
    return () => window.clearTimeout(timeout);
  }, [question, session, submit]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toUpperCase();
      const map: Record<string, number> = { A: 0, "1": 0, B: 1, "2": 1, C: 2, "3": 2 };
      const option = question?.options[map[key]];
      if (option) submit(option.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [question, submit]);

  if (!session || !question) return <MissingView navigate={navigate} />;
  const remaining = Math.max(0, question.timeoutMs - (now - session.currentQuestionStartedAt));
  const seconds = Math.max(1, Math.ceil(remaining / 1000));
  const progress = (session.currentIndex / questions.length) * 100;
  return (
    <Shell compact>
      <header className="test-header">
        <div className="test-brand"><Logo /><span>{session.currentIndex + 1} <i>/</i> {questions.length}</span></div>
        <div className={seconds === 1 ? "timer urgent" : "timer"}><span style={{ "--timer": `${remaining / question.timeoutMs * 360}deg` } as React.CSSProperties}>{seconds}</span></div>
      </header>
      <div className="top-progress"><span style={{ width: `${progress}%` }} /></div>
      <section className="question-stage" key={question.id}>
        <div className="question-number">第 {session.currentIndex + 1} 题 · {question.domain === "life" ? "生活场景" : "感情场景"}</div>
        <div className="scenario-label">想象这个场景</div>
        <h1>{question.scenarioTag}</h1>
        <p className="question-guide">你的真实反应更接近哪一种？</p>
        <div className={question.responseType === "directional" ? "option-list directional-scale" : "option-list agreement-scale"} aria-label={question.responseGuide}>
          {question.options.map((option, index) => (
            <button disabled={locked} className={`${chosen === option.id ? "chosen " : ""}${index === 1 ? "middle-option" : "side-option"}`} key={option.id} onClick={() => submit(option.id)}>
              <span>{String.fromCharCode(65 + index)}</span><b>{option.label}</b><i>{index === 1 ? "=" : "›"}</i>
            </button>
          ))}
        </div>
        <p className="test-hint">只有两种反应同样常见时，再选中间 · 没有“更好”的答案</p>
      </section>
    </Shell>
  );
}

function downloadResultPng(report: ReturnType<typeof composeReport>, title: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200; canvas.height = 1500;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#f6f8fb"; ctx.fillRect(0, 0, 1200, 1500);
  ctx.fillStyle = "#ffffff"; ctx.roundRect(60, 60, 1080, 1380, 42); ctx.fill();
  ctx.fillStyle = "#1677ff"; ctx.font = "700 28px system-ui"; ctx.fillText("INNERCOMPASS 16 · 非官方", 120, 145);
  ctx.fillStyle = "#111318"; ctx.font = "800 142px system-ui"; ctx.fillText(report.typeCode, 120, 340);
  ctx.font = "700 38px system-ui"; ctx.fillText(title, 120, 402);
  ctx.fillStyle = "#5f6875"; ctx.font = "25px system-ui";
  (report.flowTitle.match(/.{1,30}/g) || []).slice(0, 2).forEach((line, index) => ctx.fillText(line, 120, 480 + index * 38));
  report.axes.forEach((axis, index) => {
    const y = 610 + index * 122;
    ctx.fillStyle = "#111318"; ctx.font = "700 25px system-ui"; ctx.fillText(`${axis.dominantPole} ${axis.dominantPercent}%`, 120, y);
    ctx.fillStyle = "#e6ebf2"; ctx.roundRect(120, y + 22, 960, 14, 7); ctx.fill();
    ctx.fillStyle = "#1677ff"; ctx.roundRect(120, y + 22, 960 * axis.dominantPercent / 100, 14, 7); ctx.fill();
    ctx.fillStyle = "#7a828e"; ctx.font = "20px system-ui"; ctx.fillText(`${axis.title} · ${axis.strengthLabel}`, 120, y + 70);
  });
  ctx.fillStyle = "#111318"; ctx.font = "700 27px system-ui"; ctx.fillText("最高 3 项行为特质", 120, 1130);
  report.topTraits.slice(0, 3).forEach((trait, index) => {
    ctx.fillStyle = index === 0 ? "#1677ff" : "#4e5865"; ctx.font = "650 25px system-ui";
    ctx.fillText(`${String(index + 1).padStart(2, "0")}  ${trait.name}  ${trait.score}`, 120, 1185 + index * 48);
  });
  ctx.fillStyle = "#9097a1"; ctx.font = "19px system-ui";
  ctx.fillText("dongdongzou.github.io/mbti-dongdongzou", 120, 1370);
  ctx.fillText("原创非官方自我探索工具 · 不构成医学或心理诊断", 120, 1408);
  const link = document.createElement("a"); link.download = `InnerCompass-${report.typeCode}.png`; link.href = canvas.toDataURL("image/png"); link.click();
}

function RunResultView({ sessionId, navigate }: { sessionId: string; navigate: (path: string) => void }) {
  const session = loadStore().sessions.find((item) => item.id === sessionId);
  if (!session?.result) return <MissingView navigate={navigate} />;
  const result = session.result;
  const completedRuns = loadStore().sessions.filter((item) => item.result).map((item) => item.result as SessionResult).reverse();
  const report = composeReport(result, completedRuns);
  const typeCode = report.typeCode;
  const profile = profiles[typeCode];
  return (
    <Shell>
      <TopBar onHome={() => navigate("/")} action={<div className="top-actions"><button className="text-button" onClick={() => downloadResultPng(report, profile?.title || typeCode)}>导出 PNG</button><button className="text-button" onClick={() => window.print()}>打印 / PDF</button><button className="text-button" onClick={() => navigate("/history")}>历史记录</button></div>} />
      <section className="result-hero">
        <div className="result-badge">{report.runValidation.label} · {result.plannedCount} 题</div>
        <p>你的行为偏好更接近</p><h1>{typeCode}</h1><h2>{profile?.title}</h2>
        <p className="result-overview">{report.overview}</p>
      </section>
      <section className="report-card report-reading-guide"><div className="section-heading"><div><span>先这样看报告</span><h2>从结论到例子，三步就能看懂</h2></div></div><div><article><b>01</b><h3>先看四项占比</h3><p>看每一组字母中，你这次更常选择哪一边。</p></article><article><b>02</b><h3>再看场景例子</h3><p>把占比放回生活、感情和社交中理解。</p></article><article><b>03</b><h3>最后看建议</h3><p>高低都不是好坏，只代表你更常使用的路径。</p></article></div></section>
      <section className="report-card"><div className="section-heading"><div><span>01 · 四项占比</span><h2>你在四组偏好中的本次位置</h2></div><em>不是能力高低</em></div><p className="percentage-explainer">例如 E 65% / I 35%，意思是这次回答更常接近 E 侧反应，不是“人格里有 65% 是 E”。</p><AxisBars result={result} /><div className="axis-scene-grid">{report.axes.map((axis) => { const examples = SCENE_EXAMPLES[axis.dominantPole]; return <article key={axis.axis}><header><span>{axis.axis}</span><div><small>{axis.title}</small><h3>更接近 {axis.dominantPole} · {axis.dominantPercent}%</h3></div></header><dl><div><dt>生活</dt><dd>{examples.life}</dd></div><div><dt>感情</dt><dd>{examples.relationship}</dd></div><div><dt>社交</dt><dd>{examples.social}</dd></div></dl></article>; })}</div></section>
      <section className="metrics-grid">
        <article><span>完成率</span><b>{Math.round(result.completionRate * 100)}%</b><small>{result.answeredCount} / {result.plannedCount} 题有效</small></article>
        <article><span>中位反应</span><b>{(result.medianResponseMs / 1000).toFixed(1)}s</b><small>反映本次作答节奏</small></article>
        <article><span>临界维度</span><b>{AXES.filter((axis) => result.axes[axis].boundaryLabel === "near-boundary").length}</b><small>接近中线时更受情境影响</small></article>
      </section>
      <section className="report-card intro-card"><div className="section-heading"><div><span>02 · 一句话总结</span><h2>{report.flowTitle}</h2></div></div><p className="lead-copy">{report.behaviorLogic}</p></section>
      <section className="report-card"><div className="section-heading"><div><span>03 · 四项说明</span><h2>每项偏好在不同场景里怎样表现</h2></div></div><div className="axis-detail-grid">{report.axes.map((axis) => <article key={axis.axis}><div className="axis-detail-title"><b>{axis.axis}</b><div><span>{axis.title}</span><h3>{axis.dominantPole} {axis.dominantPercent}% · {axis.strengthLabel}</h3></div></div><p>{axis.definition}</p><p className="axis-summary">{axis.summary}</p><dl><div><dt>生活表现</dt><dd>{axis.life}</dd></div><div><dt>学习 / 工作</dt><dd>{axis.work}</dd></div><div><dt>感情表现</dt><dd>{axis.relationship}</dd></div><div><dt>容易被误解</dt><dd>{axis.misunderstood}</dd></div><div><dt>另一侧能力</dt><dd>{axis.otherSide}</dd></div>{axis.sceneSwitch && <div><dt>场景切换</dt><dd>{axis.sceneSwitch}</dd></div>}</dl></article>)}</div></section>
      <section className="report-card"><div className="section-heading"><div><span>04 · 十项生活特质</span><h2>把分数放回真实日常中理解</h2></div><em>0–100 · 使用频率</em></div><p className="section-intro">这里的高分表示你更自然地使用这条路径，低分表示另一种方式更省力。它们不是能力排名，也没有好坏之分。</p><div className="life-dimension-grid">{report.lifeDimensions.map((item) => <article key={item.id}><header><div><span>{item.usageLabel}</span><h3>{item.title}</h3></div><strong>{item.score}</strong></header><i><em style={{ width: `${item.score}%` }} /></i><p>{item.interpretation}</p><div className="scene-example"><b>生活例子</b><p>{item.example}</p></div></article>)}</div></section>
      <section className="report-card"><div className="section-heading"><div><span>05 · 你的核心生活资源</span><h2>最自然的六种反应方式</h2></div><em>先发挥，再平衡</em></div><div className="resource-grid">{report.coreLifeResources.map((item, index) => <article key={item.title}><div className="resource-rank">{String(index + 1).padStart(2, "0")}</div><header><div><span>{item.domain === "life" ? "日常生活" : "亲密关系"}</span><h3>{item.title}</h3></div><strong>{item.score}</strong></header><p>{item.text}</p><div><b>{item.evidence}</b><small>平衡动作：{item.action}</small></div></article>)}</div></section>
      <section className="report-card split-report life-split"><div><div className="section-heading"><div><span>06 · 日常画像</span><h2>你在生活里的常用路径</h2></div></div><p>{report.lifeSummary}</p><ul className="quality-list">{report.lifeTraits.slice(0, 5).map((trait) => <li key={trait.id}><span>{trait.name}</span><b>{trait.score}</b></li>)}</ul></div><div><div className="section-heading"><div><span>06 · 感情画像</span><h2>你在亲密关系里的常用路径</h2></div></div><p>{report.relationshipSummary}</p><ul className="quality-list">{report.relationshipTraits.slice(0, 5).map((trait) => <li key={trait.id}><span>{trait.name}</span><b>{trait.score}</b></li>)}</ul></div></section>
      {report.gaps.length > 0 && <section className="switch-card"><span>生活与感情场景差异</span><h2>你会根据关系距离调整行为权重。</h2>{report.gaps.map((gap) => <p key={gap.axis}><b>{gap.axis}</b> · {gap.text}</p>)}</section>}
      <section className="report-card"><div className="section-heading"><div><span>07 · 容易消耗的生活场景</span><h2>不是缺点，而是需要额外准备的路径</h2></div></div><div className="drain-list">{report.energyDrains.map((item) => <article key={item.title}><header><h3>{item.title}</h3><span>{item.score} · {item.score < 30 ? "通常不优先" : "较少使用"}</span></header><p>{item.text}</p><div><b>可用的小工具</b><span>{item.action}</span></div></article>)}</div></section>
      <section className="report-card"><div className="section-heading"><div><span>08 · 你的生活使用说明</span><h2>在四类关键时刻，怎样顺着自己行动</h2></div></div><div className="life-manual-grid">{report.lifeManual.map((item) => <article key={item.axis}><span>{item.axis}</span><div><small>{item.preference}</small><h3>{item.title}</h3><p>{item.text}</p></div></article>)}</div></section>
      <section className="report-card"><div className="section-heading"><div><span>09 · 成长建议</span><h2>把短板变成可以管理的生活变量</h2></div></div><p className="section-intro">不必强迫自己变成相反类型。更有效的方法，是为不自然的路径准备一个小工具、一个提醒，或一个能互补的人。</p><ol className="number-list growth-list">{report.growth.map((item) => <li key={item.title}><b>{item.title}</b><p>{item.text}</p></li>)}</ol></section>
      <details className="report-card full-trait-report"><summary><div><span>附录 · 完整数据</span><h2>查看全部 32 项行为特质</h2></div><b>展开</b></summary><div className="trait-ranking"><div className="trait-band top"><h3>最高 6 项</h3>{report.topTraits.map((trait) => <article key={trait.id}><div><b>{trait.name}</b><span>{trait.domain === "life" ? "生活" : "感情"}</span></div><strong>{trait.score}</strong><i><em style={{ width: `${trait.score}%` }} /></i><p>{trait.interpretation}</p></article>)}</div><details><summary>查看中间 20 项</summary><div className="trait-compact-grid">{report.middleTraits.map((trait) => <div key={trait.id}><span>{trait.name}</span><b>{trait.score}</b><i><em style={{ width: `${trait.score}%` }} /></i></div>)}</div></details><div className="trait-band bottom"><h3>较少依赖的 6 项</h3>{report.bottomTraits.map((trait) => <article key={trait.id}><div><b>{trait.name}</b><span>{trait.domain === "life" ? "生活" : "感情"}</span></div><strong>{trait.score}</strong><i><em style={{ width: `${trait.score}%` }} /></i><p>{trait.interpretation}</p></article>)}</div></div></details>
      <section className="report-card split-report"><div><div className="section-heading"><div><span>多次验证（可选）</span><h2>{report.runValidation.label} · {report.runValidation.count} 次</h2></div></div><p>一次完整问卷即可获得报告；重复填写只用于观察不同状态下的波动。</p><ul className="quality-list">{report.runValidation.axes.map((axis) => <li key={axis.axis}><span>{axis.axis} 波动</span><b>{axis.change} 分 · σ {axis.sd}</b></li>)}</ul></div><div><div className="section-heading"><div><span>数据质量</span><h2>这份结果如何理解</h2></div></div><ul className="quality-list"><li><span>总体可信度</span><b>{report.quality.confidence}%</b></li><li><span>有效回答</span><b>{report.quality.answered} / {report.quality.planned}</b></li><li><span>漏答率</span><b>{report.quality.missedRate}%</b></li><li><span>中位回答</span><b>{report.quality.medianSeconds}s</b></li><li><span>过快比例</span><b>{report.quality.tooFastPercent}%</b></li><li><span>接近中线</span><b>{report.quality.boundaryCount} 个维度</b></li><li><span>单一选项占比</span><b>{report.quality.dominantOptionPercent}%</b></li><li><span>题库版本</span><b>{report.quality.bankVersion}</b></li></ul></div></section>
      <div className="result-actions">
        <button className="primary-button" onClick={() => navigate("/")}>完成并返回首页 <span>→</span></button>
        <button className="secondary-button" onClick={async () => {
          const text = `我的 InnerCompass 16 行为偏好画像是 ${typeCode} · ${profile?.title}`;
          const shareUrl = window.location.hostname.endsWith("github.io") ? window.location.href.split("#")[0] : window.location.origin;
          if (navigator.share) await navigator.share({ title: "InnerCompass 16", text, url: shareUrl });
          else await navigator.clipboard.writeText(`${text} ${shareUrl}`);
        }}>分享结果</button>
      </div>
      <p className="disclaimer centered">{REQUIRED_DISCLAIMER}</p>
    </Shell>
  );
}

function HistoryView({ navigate, refresh }: { navigate: (path: string) => void; refresh: () => void }) {
  const store = loadStore();
  const remove = (id: string) => {
    const next = loadStore(); next.sessions = next.sessions.filter((item) => item.id !== id); writeStore(next); refresh();
  };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(loadStore(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "innercompass-history.json"; link.click(); URL.revokeObjectURL(url);
  };
  return (
    <Shell>
      <TopBar onHome={() => navigate("/")} action={store.sessions.length ? <button className="text-button" onClick={exportJson}>导出 JSON</button> : null} />
      <section className="history-header"><span>你的本地记录</span><h1>每次问卷，都是一份<br />完整的自我观察。</h1><p>记录仅保存在当前浏览器中。</p></section>
      <section className="history-list">
        {!store.sessions.length && <div className="empty-card"><Logo /><h2>还没有记录</h2><p>完成一次问卷后，你会在这里看到完整结果。</p><button className="primary-button" onClick={() => navigate("/setup")}>开始测试 <span>→</span></button></div>}
        {store.sessions.map((session, index) => {
          const type = session.result ? AXES.map((axis) => session.result!.axes[axis].rightPercent > 50 ? session.result!.axes[axis].rightPole : session.result!.axes[axis].leftPole).join("") : session.status === "abandoned" ? "已失效" : "进行中";
          const version = session.bankVersion ?? session.result?.bankVersion ?? "旧版";
          const summary = session.status === "active" ? `已完成 ${session.currentIndex} / ${session.questionIds.length}` : session.status === "abandoned" ? "题库升级后不可继续，历史答案未混入新版" : `完成率 ${Math.round((session.result?.completionRate || 0) * 100)}% · 中位反应 ${((session.result?.medianResponseMs || 0) / 1000).toFixed(1)} 秒`;
          return <article key={session.id}><div className="history-index">{String(index + 1).padStart(2, "0")}</div><div><span>{formatDate(session.createdAt)} · {session.questionIds.length} 题 · 题库 {version}</span><h2>{type} {session.result && <small>{profiles[type]?.title}</small>}</h2><p>{summary}</p></div><div className="history-actions"><button onClick={() => navigate(session.status === "active" ? `/test/${session.id}` : session.status === "abandoned" ? "/setup" : `/run-result/${session.id}`)}>{session.status === "active" ? "继续" : session.status === "abandoned" ? "重新开始" : "查看"}</button><button className="danger" onClick={() => remove(session.id)}>删除</button></div></article>;
        })}
      </section>
    </Shell>
  );
}

function MissingView({ navigate, empty = false }: { navigate: (path: string) => void; empty?: boolean }) {
  return <Shell compact><TopBar onHome={() => navigate("/")} /><div className="empty-card standalone"><Logo /><h2>{empty ? "还没有可用报告" : "这条记录已不存在"}</h2><p>{empty ? "先完成一轮测试，再回来查看你的偏好画像。" : "它可能已被删除，或来自另一台设备。"}</p><button className="primary-button" onClick={() => navigate(empty ? "/setup" : "/")}>{empty ? "开始测试" : "返回首页"} <span>→</span></button></div></Shell>;
}

export function InnerCompassApp() {
  const [path, setPath] = useState("/");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const currentPath = () => window.location.hostname.endsWith("github.io")
      ? window.location.hash.replace(/^#/, "") || "/"
      : window.location.pathname;
    const sync = window.setTimeout(() => setPath(currentPath()), 0);
    const onPop = () => setPath(currentPath());
    window.addEventListener("popstate", onPop);
    window.addEventListener("hashchange", onPop);
    return () => {
      window.clearTimeout(sync);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("hashchange", onPop);
    };
  }, []);
  const navigate = useCallback((next: string) => {
    if (window.location.hostname.endsWith("github.io")) window.location.hash = next;
    else window.history.pushState({}, "", next);
    setPath(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  if (path === "/setup") return <SetupView navigate={navigate} />;
  if (path === "/history") return <HistoryView navigate={navigate} refresh={() => setRevision((value) => value + 1)} />;
  if (path === "/report") {
    const latest = loadStore().sessions.find((session) => session.result);
    return latest ? <RunResultView sessionId={latest.id} navigate={navigate} /> : <MissingView navigate={navigate} empty />;
  }
  if (path.startsWith("/test/")) return <TestView sessionId={path.split("/").at(-1) || ""} navigate={navigate} />;
  if (path.startsWith("/run-result/")) return <RunResultView sessionId={path.split("/").at(-1) || ""} navigate={navigate} />;
  return <HomeView navigate={navigate} revision={revision} />;
}
