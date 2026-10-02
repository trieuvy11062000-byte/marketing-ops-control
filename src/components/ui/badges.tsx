import type { RiskLevel, ControlStatus } from "@/lib/db/types";
import type { CampaignStatus, PromotionStatus } from "@/lib/db/status";

const RISK_COLOR: Record<RiskLevel, string> = {
  RED: "var(--red)",
  AMBER: "var(--amber)",
  GREEN: "var(--green)",
};

export function RiskDot({ level }: { level: RiskLevel }) {
  return (
    <span
      className="inline-block h-[7px] w-[7px] shrink-0 rounded-full"
      style={{ backgroundColor: RISK_COLOR[level] }}
      title={level}
    />
  );
}

const STATUS_STYLE: Record<ControlStatus, { bg: string; fg: string }> = {
  "NOT STARTED": { bg: "var(--grey-bg)", fg: "var(--grey)" },
  "IN PROGRESS": { bg: "var(--blue-grey-bg)", fg: "var(--blue-grey)" },
  "WAITING FOR OUTPUT": { bg: "var(--amber-bg)", fg: "var(--amber)" },
  "WAITING FOR LEADER REVIEW": { bg: "var(--amber-bg)", fg: "var(--amber)" },
  "CHANGES REQUIRED": { bg: "var(--red-bg)", fg: "var(--red)" },
  APPROVED: { bg: "var(--green-bg)", fg: "var(--green)" },
  BLOCKED: { bg: "var(--red-bg)", fg: "var(--red)" },
  LIVE: { bg: "var(--green-bg)", fg: "var(--green)" },
  "EVIDENCE PENDING": { bg: "var(--amber-bg)", fg: "var(--amber)" },
  DELIVERED: { bg: "var(--green-bg)", fg: "var(--green)" },
  CLOSED: { bg: "var(--grey-bg)", fg: "var(--grey)" },
};

export function StatusBadge({ status }: { status: ControlStatus }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE["NOT STARTED"];
  return (
    <span
      className="font-mono-tag inline-flex items-center rounded-md px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wide"
      style={{ backgroundColor: style.bg, color: style.fg }}
    >
      {status}
    </span>
  );
}

const PROMO_STATUS_STYLE: Record<PromotionStatus, { bg: string; fg: string }> = {
  UPCOMING: { bg: "var(--grey-bg)", fg: "var(--grey)" },
  LIVE: { bg: "var(--green-bg)", fg: "var(--green)" },
  "ENDING SOON": { bg: "var(--amber-bg)", fg: "var(--amber)" },
  EXPIRED: { bg: "var(--grey-bg)", fg: "var(--grey)" },
  "EXPIRED – ACTION REQUIRED": { bg: "var(--red-bg)", fg: "var(--red)" },
};

export function PromotionStatusBadge({ status }: { status: PromotionStatus }) {
  const style = PROMO_STATUS_STYLE[status];
  return (
    <span
      className="font-mono-tag inline-flex items-center rounded-md px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wide whitespace-nowrap"
      style={{ backgroundColor: style.bg, color: style.fg }}
    >
      {status}
    </span>
  );
}

const CAMPAIGN_STATUS_STYLE: Record<CampaignStatus, { bg: string; fg: string }> = {
  UPCOMING: { bg: "var(--grey-bg)", fg: "var(--grey)" },
  PREPARING: { bg: "var(--blue-grey-bg)", fg: "var(--blue-grey)" },
  LIVE: { bg: "var(--green-bg)", fg: "var(--green)" },
  "ENDING SOON": { bg: "var(--amber-bg)", fg: "var(--amber)" },
  COMPLETED: { bg: "var(--grey-bg)", fg: "var(--grey)" },
  CANCELLED: { bg: "var(--red-bg)", fg: "var(--red)" },
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const style = CAMPAIGN_STATUS_STYLE[status];
  return (
    <span
      className="font-mono-tag inline-flex items-center rounded-md px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wide whitespace-nowrap"
      style={{ backgroundColor: style.bg, color: style.fg }}
    >
      {status}
    </span>
  );
}

export function RiskBadge({ level, reason }: { level: RiskLevel; reason?: string | null }) {
  const style = { RED: STATUS_STYLE.BLOCKED, AMBER: STATUS_STYLE["EVIDENCE PENDING"], GREEN: STATUS_STYLE.APPROVED }[level];
  return (
    <span
      className="font-mono-tag inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wide"
      style={{ backgroundColor: style.bg, color: style.fg }}
      title={reason ?? undefined}
    >
      <RiskDot level={level} />
      {level}
    </span>
  );
}
