import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveHealth, type SettlementHealthInput } from "./derive";

function baseInput(
  overrides: Partial<SettlementHealthInput> = {},
): SettlementHealthInput {
  return {
    settlement: {
      id: "stl_test",
      showId: "show_test",
      status: "signed",
      draftedAt: null,
      submittedAt: null,
      reviewStartedAt: null,
      signedAt: null,
      disputedAt: null,
      revisedAt: null,
      finalizedAt: null,
      paidAt: null,
      completedAt: null,
      completedByUserId: null,
      grossBoxOffice: 10000,
      netBoxOffice: 9000,
      totalExpenses: 1000,
      totalToArtist: 5000,
      calculationJson: null,
      recoupsJson: null,
      signoffText: null,
      notes: null,
    },
    recoups: [],
    calc: {
      supported: true,
      grossBoxOffice: 10000,
      netBoxOffice: 9000,
      totalExpenses: 1000,
      totalToArtist: 5000,
      steps: [],
      finalFormula: "flat guarantee = 5000",
      bonusesApplied: [],
      bonusesNotTriggered: [],
    },
    ...overrides,
  };
}

describe("deriveHealth", () => {
  it("healthy flat guarantee: clear, no findings", () => {
    const report = deriveHealth(baseInput());
    assert.equal(report.status, "clear");
    assert.equal(report.findings.length, 0);
  });

  it("no settlement row yet: does not throw; clear with no findings when recoups are clean", () => {
    const report = deriveHealth(
      baseInput({
        settlement: null,
      }),
    );
    assert.equal(report.status, "clear");
    assert.equal(report.findings.length, 0);
    assert.equal(
      report.headline,
      "Nothing obvious needs review from the data we can check here.",
    );
  });

  it("flags total drift on supported deals", () => {
    const report = deriveHealth(
      baseInput({
        settlement: {
          ...baseInput().settlement!,
          totalToArtist: 5240,
        },
      }),
    );
    assert.equal(report.status, "attention");
    assert.ok(report.findings.some((f) => f.id === "total_drift"));
    assert.match(report.findings[0].detail, /\$240/);
  });

  it("flags unsupported deal types", () => {
    const report = deriveHealth(
      baseInput({
        calc: {
          supported: false,
          reason: "Vs deals aren't supported",
          dealType: "vs",
        },
      }),
    );
    assert.equal(report.status, "attention");
    assert.ok(report.findings.some((f) => f.id === "tool_unsupported"));
  });

  it("paid settlement with disputed recoup: paid_open_recoup only, needs_review", () => {
    const report = deriveHealth(
      baseInput({
        settlement: {
          ...baseInput().settlement!,
          status: "paid",
        },
        recoups: [
          {
            id: "r1",
            category: "marketing",
            label: "IG boost",
            amount: 340,
            status: "disputed",
          },
        ],
      }),
    );
    assert.equal(report.status, "needs_review");
    assert.equal(report.findings.length, 1);
    assert.equal(report.findings[0].id, "paid_open_recoup");
    assert.equal(
      report.findings.find((f) => f.id === "recoup_disputed"),
      undefined,
    );
  });

  it("flags disputed status with affirmative sign-off", () => {
    const report = deriveHealth(
      baseInput({
        settlement: {
          ...baseInput().settlement!,
          status: "disputed",
          signoffText: "Looks good — wire when ready.",
        },
      }),
    );
    assert.equal(report.status, "needs_review");
    assert.ok(report.findings.some((f) => f.id === "signoff_status_mismatch"));
  });

  it("unsupported deal plus signoff mismatch: signoff outranks tool_unsupported", () => {
    const report = deriveHealth(
      baseInput({
        calc: {
          supported: false,
          reason: "Vs deals aren't supported",
          dealType: "vs",
        },
        settlement: {
          ...baseInput().settlement!,
          status: "disputed",
          signoffText: "ok wire monday",
        },
      }),
    );
    assert.equal(report.status, "needs_review");
    assert.equal(report.findings.length, 2);
    assert.equal(report.findings[0].id, "signoff_status_mismatch");
    assert.equal(report.findings[1].id, "tool_unsupported");
  });

  it("total drift at or under $1: no total_drift finding", () => {
    const report = deriveHealth(
      baseInput({
        settlement: {
          ...baseInput().settlement!,
          totalToArtist: 5000.5,
        },
        calc: {
          supported: true,
          grossBoxOffice: 10000,
          netBoxOffice: 9000,
          totalExpenses: 1000,
          totalToArtist: 5000,
          steps: [],
          finalFormula: "flat guarantee = 5000",
          bonusesApplied: [],
          bonusesNotTriggered: [],
        },
      }),
    );
    assert.equal(report.status, "clear");
    assert.equal(
      report.findings.some((f) => f.id === "total_drift"),
      false,
    );
  });

  it("large total drift: high severity, needs_review, total_drift first", () => {
    const report = deriveHealth(
      baseInput({
        settlement: {
          ...baseInput().settlement!,
          totalToArtist: 5300,
        },
        calc: {
          supported: true,
          grossBoxOffice: 10000,
          netBoxOffice: 9000,
          totalExpenses: 1000,
          totalToArtist: 5000,
          steps: [],
          finalFormula: "flat guarantee = 5000",
          bonusesApplied: [],
          bonusesNotTriggered: [],
        },
      }),
    );
    assert.equal(report.status, "needs_review");
    assert.equal(report.findings[0].id, "total_drift");
    assert.equal(report.findings[0].severity, "high");
  });
});
