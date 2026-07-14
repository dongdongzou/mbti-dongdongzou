"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import questionBankJson from "@/lib/data/question_bank_320.json";
import profilesJson from "@/lib/data/type_profiles_16.json";
import config from "@/lib/data/test_config.json";
import reportSchema from "@/lib/data/report_schema.json";
import { buildBehaviorQuestionBank } from "@/lib/questionBank";
import { aggregateRuns, computeSessionResult, selectQuestions } from "@/lib/scoring";
import type { AggregateResult, Axis, Question, ResponseRecord, SessionResult } from "@/lib/schemas";

const STORE_KEY = "innercompass16:v2";
const AXES: Axis[] = ["EI", "SN", "TF", "JP"];
const bank = buildBehaviorQuestionBank(
  questionBankJson.questions as unknown as Question[],
  config.session.questionTimeoutMs,
);

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
  dataVersion: 2;
};

type Store = { version: 2; sessions: StoredSession[] };

const emptyStore = (): Store => ({ version: 2, sessions: [] });

function loadStore(): Store {
  if (typeof window === "undefined") return emptyStore();
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (!parsed || !Array.isArray(parsed.sessions)) return emptyStore();
    return { version: 2, sessions: parsed.sessions };
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
  return session.questionIds.map((id) => byId.get(id)).filter(Boolean) as Question[];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function confidenceLabel(value: number) {
  if (value >= 78) return "较高";
  if (value >= 58) return "中等";
  return "待验证";
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

function AxisBars({ result, aggregate }: { result?: SessionResult; aggregate?: AggregateResult }) {
  const axes = aggregate?.axes || result?.axes;
  if (!axes) return null;
  return (
    <div className="axis-list">
      {AXES.map((axis) => {
        const score = axes[axis];
        const near = score.boundaryLabel === "near-boundary";
        return (
          <div className="axis-row" key={axis}>
            <div className="axis-labels"><b>{score.leftPole} {Math.round(score.leftPercent)}%</b><span>{near ? "情境型" : aggregate ? "综合" : "本次"}</span><b>{Math.round(score.rightPercent)}% {score.rightPole}</b></div>
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
  return (
    <Shell>
      <TopBar onHome={() => navigate("/")} action={<button className="text-button" onClick={() => navigate("/history")}>历史记录</button>} />
      <section className="hero">
        <div className="hero-kicker"><span /> 原创 · 非官方 · 一次完成</div>
        <h1>更安静地，<br />看见自己的<span>行为偏好</span>。</h1>
        <p className="hero-copy">从生活与关系中的真实行为出发，用简短感受判断，完成一次即可获得完整的偏好画像。</p>
        <div className="hero-actions">
          <button className="primary-button" onClick={() => navigate("/setup")}>开始第一次测试 <span>→</span></button>
          {active && <button className="secondary-button" onClick={() => navigate(`/test/${active.id}`)}>继续上次测试 · {active.currentIndex + 1}/{active.questionIds.length}</button>}
          {!active && completed.length > 0 && <button className="secondary-button" onClick={() => navigate(`/run-result/${completed[0].id}`)}>查看最近结果</button>}
        </div>
        <div className="trust-row">
          <span><b>80–120</b> 题</span><i /><span><b>8</b> 秒快速判断</span><i /><span>完成 <b>1</b> 次即可</span>
        </div>
      </section>
      <section className="feature-grid">
        <article><span className="feature-icon">◌</span><h3>情境，而非标签</h3><p>同时观察日常生活与亲密关系中的偏好变化，不用一个字母概括全部的你。</p></article>
        <article><span className="feature-icon">⌁</span><h3>一次完整画像</h3><p>题量覆盖四个偏好维度与生活、关系场景，一次完成即可查看完整结果。</p></article>
        <article><span className="feature-icon">⌂</span><h3>答案只在本机</h3><p>无需注册，数据默认保存在当前设备的浏览器中，也可以随时导出或删除。</p></article>
      </section>
      <footer className="disclaimer">基于 MBTI 四偏好框架的原创非官方工具，不是官方认证评估，也不构成医学或心理诊断。</footer>
    </Shell>
  );
}

function SetupView({ navigate }: { navigate: (path: string) => void }) {
  const [count, setCount] = useState(config.session.defaultQuestionCount);
  const start = () => {
    const store = loadStore();
    const recent = store.sessions.slice(0, 3).flatMap((session) => session.questionIds);
    const seed = Date.now();
    const selected = selectQuestions(bank, count, recent, seed);
    const session: StoredSession = {
      id: `ic-${seed.toString(36)}`, seed, questionIds: selected.map((question) => question.id),
      currentIndex: 0, currentQuestionStartedAt: Date.now(), responses: [], status: "active",
      createdAt: new Date().toISOString(), dataVersion: 2,
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
        <p>每题最多 8 秒，没有标准答案。请选择此刻更自然的反应。</p>
        <div className="count-selector" role="radiogroup" aria-label="题目数量">
          {[80, 100, 120].map((value) => <button key={value} role="radio" aria-checked={count === value} className={count === value ? "selected" : ""} onClick={() => setCount(value)}><b>{value}</b><span>题</span>{value === 100 && <em>推荐</em>}</button>)}
        </div>
        <div className="setup-summary">
          <div><span>预计用时</span><b>约 {Math.ceil(count * 6 / 60)}–{Math.ceil(count * 8 / 60)} 分钟</b></div>
          <div><span>场景配比</span><b>生活 50% · 关系 50%</b></div>
          <div><span>计时规则</span><b>每题 8 秒 · 不可返回</b></div>
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

  const submit = useCallback((optionId: "A" | "B" | "C" | null) => {
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
      questionId: currentQuestion.id, selectedOptionId: optionId, score: option?.score ?? null,
      elapsedMs: Math.min(Date.now() - current.currentQuestionStartedAt, currentQuestion.timeoutMs),
      timedOut: optionId === null, answeredAt: new Date().toISOString(),
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
      const map: Record<string, "A" | "B" | "C"> = { A: "A", "1": "A", B: "B", "2": "B", C: "C", "3": "C" };
      if (map[key]) submit(map[key]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit]);

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
        <div className="question-number">第 {session.currentIndex + 1} 题</div>
        <h1>{question.prompt}</h1>
        <div className="option-list agreement-scale" aria-label="符合程度">
          {question.options.map((option, index) => (
            <button disabled={locked} className={chosen === option.id ? "chosen" : ""} key={option.id} onClick={() => submit(option.id)}>
              <span>{String.fromCharCode(65 + index)}</span><b>{option.text}</b>
            </button>
          ))}
        </div>
        <p className="test-hint">请选择这个行为描述与你的符合程度</p>
      </section>
    </Shell>
  );
}

function RunResultView({ sessionId, navigate }: { sessionId: string; navigate: (path: string) => void }) {
  const session = loadStore().sessions.find((item) => item.id === sessionId);
  if (!session?.result) return <MissingView navigate={navigate} />;
  const result = session.result;
  const typeCode = AXES.map((axis) => result.axes[axis].rightPercent > 50 ? result.axes[axis].rightPole : result.axes[axis].leftPole).join("");
  const profile = profiles[typeCode];
  return (
    <Shell>
      <TopBar onHome={() => navigate("/")} action={<button className="text-button" onClick={() => navigate("/history")}>历史记录</button>} />
      <section className="result-hero">
        <div className="result-badge">完整画像 · {result.plannedCount} 题</div>
        <p>你的行为偏好更接近</p><h1>{typeCode}</h1><h2>{profile?.title}</h2>
        <p className="result-overview">{profile?.overview}</p>
      </section>
      <section className="report-card"><div className="section-heading"><div><span>偏好分布</span><h2>四个维度的本次位置</h2></div><em>结果不是能力高低</em></div><AxisBars result={result} /></section>
      <section className="metrics-grid">
        <article><span>完成率</span><b>{Math.round(result.completionRate * 100)}%</b><small>{result.answeredCount} / {result.plannedCount} 题有效</small></article>
        <article><span>中位反应</span><b>{(result.medianResponseMs / 1000).toFixed(1)}s</b><small>反映本次作答节奏</small></article>
        <article><span>临界维度</span><b>{AXES.filter((axis) => result.axes[axis].boundaryLabel === "near-boundary").length}</b><small>接近中线时更受情境影响</small></article>
      </section>
      {profile && <>
        <section className="report-card intro-card"><div className="section-heading"><div><span>行为解读</span><h2>你更常使用的行为路径</h2></div></div><div className="insight-grid"><div><span>行为逻辑</span><p>{profile.behaviorLogic}</p></div><div><span>压力下的倾向</span><p>{profile.stressPattern}</p></div></div></section>
        <section className="report-card split-report"><div><div className="section-heading"><div><span>亲密关系</span><h2>关系中的你</h2></div></div><p>{profile.relationship}</p></div><div><div className="section-heading"><div><span>优势证据</span><h2>你可以信任的部分</h2></div></div><ul className="bullet-list">{profile.strengths.map((item) => <li key={item}>{item}</li>)}</ul></div></section>
        <section className="report-card"><div className="section-heading"><div><span>成长建议</span><h2>可以开始的小动作</h2></div></div><ol className="number-list">{profile.growth.map((item) => <li key={item}>{item}</li>)}</ol></section>
      </>}
      <div className="result-actions">
        <button className="primary-button" onClick={() => navigate("/")}>完成并返回首页 <span>→</span></button>
        <button className="secondary-button" onClick={async () => {
          const text = `我的 InnerCompass 16 行为偏好画像是 ${typeCode} · ${profile?.title}`;
          const shareUrl = window.location.hostname.endsWith("github.io") ? window.location.href.split("#")[0] : window.location.origin;
          if (navigator.share) await navigator.share({ title: "InnerCompass 16", text, url: shareUrl });
          else await navigator.clipboard.writeText(`${text} ${shareUrl}`);
        }}>分享结果</button>
      </div>
      <p className="disclaimer centered">一次完成即可形成完整画像；结果反映当前的行为偏好，不构成医学或心理诊断。</p>
    </Shell>
  );
}

function downloadReportPng(aggregate: AggregateResult, profile: TypeProfile) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200; canvas.height = 1500;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#f7f8fb"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff"; ctx.roundRect(70, 70, 1060, 1360, 40); ctx.fill();
  ctx.fillStyle = "#111318"; ctx.font = "700 38px system-ui"; ctx.fillText("InnerCompass 16", 130, 155);
  ctx.fillStyle = "#6b7280"; ctx.font = "26px system-ui"; ctx.fillText("我的行为偏好画像", 130, 220);
  ctx.fillStyle = "#111318"; ctx.font = "800 150px system-ui"; ctx.fillText(aggregate.typeCode, 130, 420);
  ctx.font = "700 42px system-ui"; ctx.fillText(profile.title, 130, 490);
  ctx.fillStyle = "#6b7280"; ctx.font = "26px system-ui";
  const lines = profile.overview.match(/.{1,28}/g) || [];
  lines.slice(0, 3).forEach((line, index) => ctx.fillText(line, 130, 565 + index * 42));
  AXES.forEach((axis, index) => {
    const score = aggregate.axes[axis]; const y = 760 + index * 130;
    ctx.fillStyle = "#111318"; ctx.font = "700 28px system-ui"; ctx.fillText(`${score.leftPole}  ${Math.round(score.leftPercent)}%`, 130, y);
    ctx.textAlign = "right"; ctx.fillText(`${Math.round(score.rightPercent)}%  ${score.rightPole}`, 1070, y); ctx.textAlign = "left";
    ctx.fillStyle = "#e8ebf1"; ctx.roundRect(130, y + 28, 940, 20, 10); ctx.fill();
    ctx.fillStyle = "#1677ff"; ctx.roundRect(130, y + 28, 940 * score.leftPercent / 100, 20, 10); ctx.fill();
  });
  ctx.fillStyle = "#9ca3af"; ctx.font = "22px system-ui"; ctx.fillText("原创非官方自我探索工具 · 不构成医学或心理诊断", 130, 1365);
  const link = document.createElement("a"); link.download = `InnerCompass-${aggregate.typeCode}.png`; link.href = canvas.toDataURL("image/png"); link.click();
}

function ReportView({ navigate }: { navigate: (path: string) => void }) {
  const sessions = loadStore().sessions.filter((item) => item.result);
  const runs = sessions.map((item) => item.result as SessionResult).reverse();
  if (!runs.length) return <MissingView navigate={navigate} empty />;
  const aggregate = aggregateRuns(runs);
  const profile = profiles[aggregate.typeCode];
  const gaps = AXES.map((axis) => {
    const life = runs.reduce((sum, run) => sum + run.domainAxes.life[axis].rightPercent, 0) / runs.length;
    const relationship = runs.reduce((sum, run) => sum + run.domainAxes.relationship[axis].rightPercent, 0) / runs.length;
    return { axis, life, relationship, gap: Math.abs(life - relationship) };
  }).filter((item) => item.gap >= 12);
  const featureEntries = Object.entries(aggregate.lifeFeatureScores);
  return (
    <Shell>
      <TopBar onHome={() => navigate("/")} action={<div className="top-actions"><button className="text-button" onClick={() => downloadReportPng(aggregate, profile)}>导出 PNG</button><button className="text-button" onClick={() => window.print()}>打印 / PDF</button></div>} />
      <section className="report-header">
        <div><span>完整画像 · {runs.length} 份本地记录</span><h1>{aggregate.typeCode}</h1><h2>{profile.title}</h2></div>
        <div className="confidence-ring"><b>{Math.round(aggregate.overallConfidence)}</b><span>可信度 · {confidenceLabel(aggregate.overallConfidence)}</span></div>
      </section>
      <section className="report-card intro-card"><div className="section-heading"><div><span>心理概述</span><h2>你更常使用的行为路径</h2></div></div><p className="lead-copy">{profile.overview}</p><div className="insight-grid"><div><span>行为逻辑</span><p>{profile.behaviorLogic}</p></div><div><span>压力下的倾向</span><p>{profile.stressPattern}</p></div></div></section>
      <section className="report-card"><div className="section-heading"><div><span>四维度占比</span><h2>偏好位置</h2></div><em>数字比标签更重要</em></div><AxisBars aggregate={aggregate} /></section>
      {gaps.length > 0 && <section className="switch-card"><span>场景切换</span><h2>你会根据关系距离，调整行为权重。</h2>{gaps.map(({ axis, life, relationship }) => <p key={axis}>在 {axis} 维度上，你的生活场景位置为 {Math.round(life)}%，关系场景为 {Math.round(relationship)}%。这不代表前后矛盾，而是你在亲密关系中使用了不同的应对权重。</p>)}</section>}
      <section className="report-card"><div className="section-heading"><div><span>生活特性</span><h2>八项可观察偏好</h2></div></div><div className="feature-score-grid">{featureEntries.map(([name, score]) => <div key={name}><span>{name}</span><b>{Math.round(score)}</b><i><em style={{ width: `${score}%` }} /></i></div>)}</div></section>
      <section className="report-card split-report"><div><div className="section-heading"><div><span>亲密关系</span><h2>关系中的你</h2></div></div><p>{profile.relationship}</p></div><div><div className="section-heading"><div><span>数据质量</span><h2>这份结果如何理解</h2></div></div><ul className="quality-list"><li>加权完成率 <b>{Math.round(aggregate.dataQuality.weightedCompletionRate)}%</b></li><li>快速作答比例 <b>{Math.round(aggregate.dataQuality.meanTooFastRate)}%</b></li><li>本地问卷记录 <b>{aggregate.runCount} 份</b></li></ul></div></section>
      <section className="report-card split-report"><div><div className="section-heading"><div><span>优势证据</span><h2>你可以信任的部分</h2></div></div><ul className="bullet-list">{profile.strengths.map((item) => <li key={item}>{item}</li>)}</ul></div><div><div className="section-heading"><div><span>成长建议</span><h2>可以开始的小动作</h2></div></div><ol className="number-list">{profile.growth.map((item) => <li key={item}>{item}</li>)}</ol></div></section>
      <section className="report-note"><h3>{reportSchema.reportSections.at(-1)?.title}</h3><p>{reportSchema.reportSections.at(-1) && "text" in reportSchema.reportSections.at(-1)! ? reportSchema.reportSections.at(-1)!.text : "本结果用于自我观察，不构成诊断。"}</p></section>
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
          const type = session.result ? AXES.map((axis) => session.result!.axes[axis].rightPercent > 50 ? session.result!.axes[axis].rightPole : session.result!.axes[axis].leftPole).join("") : "进行中";
          return <article key={session.id}><div className="history-index">{String(index + 1).padStart(2, "0")}</div><div><span>{formatDate(session.createdAt)} · {session.questionIds.length} 题</span><h2>{type} {session.result && <small>{profiles[type]?.title}</small>}</h2><p>{session.status === "active" ? `已完成 ${session.currentIndex} / ${session.questionIds.length}` : `完成率 ${Math.round((session.result?.completionRate || 0) * 100)}% · 中位反应 ${((session.result?.medianResponseMs || 0) / 1000).toFixed(1)} 秒`}</p></div><div className="history-actions"><button onClick={() => navigate(session.status === "active" ? `/test/${session.id}` : `/run-result/${session.id}`)}>{session.status === "active" ? "继续" : "查看"}</button><button className="danger" onClick={() => remove(session.id)}>删除</button></div></article>;
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
  if (path === "/report") return <ReportView navigate={navigate} />;
  if (path.startsWith("/test/")) return <TestView sessionId={path.split("/").at(-1) || ""} navigate={navigate} />;
  if (path.startsWith("/run-result/")) return <RunResultView sessionId={path.split("/").at(-1) || ""} navigate={navigate} />;
  return <HomeView navigate={navigate} revision={revision} />;
}
