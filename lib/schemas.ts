export type Axis = "EI" | "SN" | "TF" | "JP";
export type Domain = "life" | "relationship";
export type Pole = "E" | "I" | "S" | "N" | "T" | "F" | "J" | "P";
export type ResponseType = "selfMatch" | "frequency" | "directional";

export interface QuestionOption {
  id: "A" | "B" | "C";
  label: string;
  axisScore: -2 | 0 | 2;
  traitScore: -2 | 0 | 2;
  pole: Pole | null;
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
  targetPole: Pole;
  responseType: ResponseType;
  responseGuide: string;
  scenarioTag: string;
  mirrorGroup: string;
  prompt: string;
  options: QuestionOption[];
  reverseScored: boolean;
  readingLength: number;
  estimatedReadingMs: number;
  timeoutMs: 8000;
  weight: number;
  isOriginal: true;
  isActive: boolean;
}

export interface ResponseRecord {
  questionId: string;
  selectedOptionId: "A" | "B" | "C" | null;
  axisScore: -2 | 0 | 2 | null;
  traitScore: -2 | 0 | 2 | null;
  elapsedMs: number;
  timedOut: boolean;
  bankVersion: string;
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
  boundaryLabel: "near-boundary" | "mild" | "clear" | "strong" | "extreme";
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
  bankVersion: string;
  responseTypeCounts: Record<ResponseType, number>;
  optionSelectionCounts: Record<string, number>;
  dominantOptionRate: number;
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
