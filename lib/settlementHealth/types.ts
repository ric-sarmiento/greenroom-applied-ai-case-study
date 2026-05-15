/**
 * Settlement health — minimal types for request-time derivation.
 */

export type Severity = "info" | "warning" | "high";

export type HealthStatus = "clear" | "attention" | "needs_review";

export type Finding = {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
};

export type HealthReport = {
  status: HealthStatus;
  headline: string;
  findings: Finding[];
};
