export type Axis = "EI" | "SN" | "TF" | "JP";
export type Domain = "life" | "relationship";
export type Pole = "E" | "I" | "S" | "N" | "T" | "F" | "J" | "P";
export type ResponseType = "selfMatch" | "frequency" | "directional";

export interface QuestionOption {
  id: string;
  label: string;
  score: -2 | 0 | 2;
  pole?: Pole;
}

export interface Question {
  id: string;
  version: string;
  axis: Axis;
  domain: Domain;
  facetId: string;
  facetName: string;
  responseType: ResponseType;
  scenarioTag: string;
  mirrorGroup: string;
  prompt: string;
  options: QuestionOption[];
  reverseScored: boolean;
  readingLength: number;
  estimatedReadingMs: number;
  weight: number;
  isOriginal: true;
  isActive: boolean;
  sourceQuestionId?: string;
}

export interface ResponseRecord {
  questionId: string;
  selectedOptionId: string | null;
  score: -2 | -1 | 0 | 1 | 2 | null;
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
