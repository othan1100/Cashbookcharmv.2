import type { PlanType } from "@/hooks/usePlan";

export type FeatureKey =
  | "import_receipt"
  | "multi_cashbook"
  | "advanced_reports"
  | "pdf_export"
  | "csv_export"
  | "customer_reminders"
  | "attachments"
  | "priority_support"
  | "team_management"
  | "audit_logs";

export type FeatureDef = {
  key: FeatureKey;
  name: string;
  requires: Exclude<PlanType, "starter">;
  benefits: string[];
};

export const FEATURES: Record<FeatureKey, FeatureDef> = {
  import_receipt: {
    key: "import_receipt",
    name: "AI Receipt Import",
    requires: "pro",
    benefits: [
      "Snap a photo of any receipt or invoice",
      "Auto-fill amount, customer, date, and category",
      "Save minutes on every entry",
    ],
  },
  multi_cashbook: {
    key: "multi_cashbook",
    name: "Unlimited Cashbooks",
    requires: "pro",
    benefits: [
      "Manage multiple businesses in one account",
      "Keep each cashbook's data completely separate",
      "Switch between books in one tap",
    ],
  },
  advanced_reports: {
    key: "advanced_reports",
    name: "Advanced Reports",
    requires: "pro",
    benefits: [
      "Daily, weekly, quarterly, yearly views",
      "Custom date ranges",
      "Deeper analytics and trends",
    ],
  },
  pdf_export: {
    key: "pdf_export",
    name: "PDF Export",
    requires: "pro",
    benefits: [
      "Download branded business reports",
      "Share with accountants or partners",
      "Print-ready statements",
    ],
  },
  csv_export: {
    key: "csv_export",
    name: "CSV Export",
    requires: "pro",
    benefits: [
      "Export all transactions to spreadsheet",
      "Bring your data anywhere",
      "Integrate with accounting tools",
    ],
  },
  customer_reminders: {
    key: "customer_reminders",
    name: "Customer Reminders",
    requires: "pro",
    benefits: [
      "Send WhatsApp / SMS payment reminders",
      "Get paid faster",
      "Automated follow-ups",
    ],
  },
  attachments: {
    key: "attachments",
    name: "Attachments & Receipts",
    requires: "pro",
    benefits: [
      "Attach receipts to any transaction",
      "Keep proof of every entry",
      "Stay audit-ready",
    ],
  },
  priority_support: {
    key: "priority_support",
    name: "Priority Support",
    requires: "pro",
    benefits: [
      "Priority email + WhatsApp support",
      "Faster response times",
      "Direct line to our team",
    ],
  },
  team_management: {
    key: "team_management",
    name: "Team Management",
    requires: "team",
    benefits: [
      "Invite up to 10 team members",
      "Role-based permissions (admin, editor, viewer)",
      "Shared business cashbooks",
    ],
  },
  audit_logs: {
    key: "audit_logs",
    name: "Audit Logs",
    requires: "team",
    benefits: [
      "Full activity history of every change",
      "Track who did what and when",
      "Enterprise-grade accountability",
    ],
  },
};

const RANK: Record<PlanType, number> = { starter: 0, pro: 1, team: 2 };

export function planMeets(current: PlanType, required: PlanType): boolean {
  return RANK[current] >= RANK[required];
}

export function canUseFeature(current: PlanType, key: FeatureKey): boolean {
  return planMeets(current, FEATURES[key].requires);
}
