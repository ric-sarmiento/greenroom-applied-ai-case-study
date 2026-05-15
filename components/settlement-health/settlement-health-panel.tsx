import { Card, CardContent } from "@/components/ui/card";
import { PlainBadge } from "@/components/ui/badge";
import type { HealthReport, HealthStatus } from "@/lib/settlementHealth/types";

const STATUS_LABEL: Record<HealthStatus, string> = {
  clear: "Clear",
  attention: "Needs attention",
  needs_review: "Needs review",
};

const STATUS_VARIANT: Record<
  HealthStatus,
  "brand" | "amber" | "rose" | "default"
> = {
  clear: "default",
  attention: "amber",
  needs_review: "rose",
};

export function SettlementHealthPanel({ report }: { report: HealthReport }) {
  const hasFindings = report.findings.length > 0;

  return (
    <Card className="mb-6">
      <CardContent className="py-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-400">
            Settlement check
          </span>
          <PlainBadge variant={STATUS_VARIANT[report.status]}>
            {STATUS_LABEL[report.status]}
          </PlainBadge>
        </div>

        <p
          className={`text-[14px] font-medium text-ink-900 leading-relaxed ${
            hasFindings ? "mb-5" : "mb-0"
          }`}
        >
          {report.headline}
        </p>

        {hasFindings ? (
          <ul className="space-y-4 border-t border-ink-100/80 pt-5">
            {report.findings.map((finding) => (
              <li key={finding.id}>
                <div className="text-[13px] text-ink-700 leading-snug">
                  {finding.title}
                </div>
                <div className="text-[12.5px] text-ink-500 leading-relaxed mt-1">
                  {finding.detail}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
