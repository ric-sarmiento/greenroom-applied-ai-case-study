/**
 * Settlement health derivation — read-only, deterministic checks for operators.
 */

import type { Recoup, Settlement } from "@/db/schema";
import type { SettlementCalculation } from "@/lib/dealMath";
import { formatMoney } from "@/lib/format";
import type { Finding, HealthReport, HealthStatus, Severity } from "./types";

const DRIFT_THRESHOLD = 1;
const DRIFT_HIGH_THRESHOLD = 250;

const SEVERITY_RANK: Record<Severity, number> = {
  info: 0,
  warning: 1,
  high: 2,
};

const AFFIRMATIVE_SIGNOFF =
  /looks good|sign off|sign off\.|👍|wire to|wire monday|\bok\b/i;

export type SettlementHealthInput = {
  settlement: Settlement | null;
  recoups: Recoup[];
  calc: SettlementCalculation;
};

export function deriveHealth(input: SettlementHealthInput): HealthReport {
  const findings: Finding[] = [
    checkToolUnsupported(input),
    checkTotalDrift(input),
    checkRecoupDisputed(input),
    checkPaidOpenRecoup(input),
    checkSignoffStatusMismatch(input),
  ].filter((f): f is Finding => f != null);

  findings.sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
  );

  const status = aggregateStatus(findings);
  const headline = buildHeadline(status, findings);

  return { status, headline, findings };
}

function checkToolUnsupported(input: SettlementHealthInput): Finding | null {
  if (input.calc.supported) return null;

  return {
    id: "tool_unsupported",
    severity: "warning",
    title: "In-app worksheet can’t settle this deal type",
    detail:
      "Mariana usually runs this on a spreadsheet. Check the stored total and deal notes against your sheet before sending anything out.",
  };
}

function checkTotalDrift(input: SettlementHealthInput): Finding | null {
  const { settlement, calc } = input;
  if (!calc.supported || settlement?.totalToArtist == null) return null;

  const stored = settlement.totalToArtist;
  const worksheet = calc.totalToArtist;
  const delta = Math.abs(stored - worksheet);

  if (delta <= DRIFT_THRESHOLD) return null;

  const direction = stored > worksheet ? "higher" : "lower";
  const severity: Severity =
    delta > DRIFT_HIGH_THRESHOLD ? "high" : "warning";

  return {
    id: "total_drift",
    severity,
    title: "Stored total doesn’t match the worksheet",
    detail: `Logged in Greenroom as ${formatMoney(stored)}; worksheet shows ${formatMoney(worksheet)} (${formatMoney(delta)} ${direction}). Confirm which number you’re standing behind.`,
  };
}

function checkRecoupDisputed(input: SettlementHealthInput): Finding | null {
  const disputed = input.recoups.filter((r) => r.status === "disputed");
  if (disputed.length === 0) return null;

  // paid_open_recoup carries the stronger message when both apply
  if (input.settlement?.status === "paid") return null;

  const total = disputed.reduce((sum, r) => sum + r.amount, 0);
  const count = disputed.length;

  return {
    id: "recoup_disputed",
    severity: "high",
    title:
      count === 1
        ? "A recoup line is still contested"
        : `${count} recoup lines are still contested`,
    detail: `${formatMoney(total)} in recoups flagged by the artist team. Resolve or document before you treat the settlement as final.`,
  };
}

function checkPaidOpenRecoup(input: SettlementHealthInput): Finding | null {
  if (input.settlement?.status !== "paid") return null;

  const disputed = input.recoups.filter((r) => r.status === "disputed");
  if (disputed.length === 0) return null;

  const total = disputed.reduce((sum, r) => sum + r.amount, 0);

  return {
    id: "paid_open_recoup",
    severity: "high",
    title: "Marked paid, but a recoup is still open",
    detail: `${formatMoney(total)} in contested recoups after payment was logged. Worth a follow-up so this doesn’t linger on the books.`,
  };
}

function checkSignoffStatusMismatch(
  input: SettlementHealthInput,
): Finding | null {
  const { settlement } = input;
  if (settlement?.status !== "disputed" || !settlement.signoffText) return null;

  if (!AFFIRMATIVE_SIGNOFF.test(settlement.signoffText)) return null;

  return {
    id: "signoff_status_mismatch",
    severity: "high",
    title: "Sign-off looks approved, but status is still disputed",
    detail: `Artist side said “${settlement.signoffText.trim()}” while this settlement is still flagged disputed. Read Mariana’s notes before you reply or re-send.`,
  };
}

function aggregateStatus(findings: Finding[]): HealthStatus {
  if (findings.some((f) => f.severity === "high")) return "needs_review";
  if (findings.some((f) => f.severity === "warning")) return "attention";
  return "clear";
}

function buildHeadline(status: HealthStatus, findings: Finding[]): string {
  if (status === "clear") {
    return "Nothing obvious needs review from the data we can check here.";
  }

  const top = findings[0];
  if (!top) {
    return status === "needs_review"
      ? "Worth a careful read before you send or close this out."
      : "A few things to double-check when you have a minute.";
  }

  switch (top.id) {
    case "paid_open_recoup":
      return "Payment is logged, but a recoup dispute is still open — confirm whether follow-up is needed.";
    case "signoff_status_mismatch":
      return "The sign-off and dispute status don’t line up — read the notes before you respond.";
    case "total_drift":
      return "The logged total and worksheet don’t match — confirm the number you’re using.";
    case "recoup_disputed":
      return "Recoup lines are still contested — settle those before you call this done.";
    case "tool_unsupported":
      return "This deal needs your spreadsheet — Greenroom can’t verify the math in-app.";
    default:
      return status === "needs_review"
        ? "Worth a careful read before you send or close this out."
        : "A few things to double-check when you have a minute.";
  }
}
