export type Axis = "EI" | "SN" | "TF" | "JP";
export type Domain = "life" | "relationship";
export type Pole = "E" | "I" | "S" | "N" | "T" | "F" | "J" | "P";

export interface QuestionOption {
  id: "A" | "B" | "C";
  text: string;
  score: -1 | 0 | 1;
  pole: Pole | null;
}

export interface Question {
  id: string;
  axis: Axis;
  axisLabel: string;
  leftPole: Pole;
  rightPole: Pole;
  domain: Domain;
  facet: string;
  facetLabel: string;
  scenarioKey: string;
  scenarioTag: string;
  variant: 1 | 2;
  mirrorGroup: string;
  prompt: string;
  options: QuestionOption[];
  timeoutMs: number;
  isOriginalItem: boolean;
}

export interface ResponseRecord {
  questionId: string;
  selectedOptionId: "A" | "B" | "C" | null;
  score: -1 | 0 | 1 | null;
  elapsedMs: number;
  timedOut: boolean;
  answeredAt: string;
}

export interface AxisScore {
  axis: Axis;
  leftPole: Pole;
  rightPole: Pole;
  leftPercent: number;
  rightPercent: number;
  answered: number;
  timedOut: number;
  margin: number;
  boundaryLabel: "near-boundary" | "mild" | "clear" | "strong";
}

export interface SessionResult {
  sessionId: string;
  createdAt: string;
  plannedCount: number;
  answeredCount: number;
  completionRate: number;
  medianResponseMs: number;
  tooFastRate: number;
  qualityWeight: number;
  axes: Record<Axis, AxisScore>;
  domainAxes: Record<Domain, Record<Axis, AxisScore>>;
  facetScores: Record<string, number>;
  contradictionRate: number;
}

export interface AggregateResult {
  typeCode: string;
  runCount: number;
  overallConfidence: number;
  axes: Record<Axis, AxisScore & {
    runStandardDeviation: number;
    stabilityLabel: "stable" | "moderate" | "unstable";
  }>;
  lifeFeatureScores: Record<string, number>;
  relationshipFeatureScores: Record<string, number>;
  dataQuality: {
    weightedCompletionRate: number;
    meanContradictionRate: number;
    meanTooFastRate: number;
  };
}