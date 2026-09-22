export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "won",
  "lost",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_SOURCES = [
  "website",
  "google-ads",
  "facebook-ads",
  "linkedin",
  "referral",
  "webinar",
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];

export type Lead = {
  id: string;
  workspaceId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  company: string;
  jobTitle: string;
  website: string;
  city: string;
  country: string;
  source: LeadSource;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  budget: number | null;
  message: string;
  status: LeadStatus;
  score: number;
  assignedTo: string | null;
  tags: string[];
  consentMarketing: boolean;
  ipAddress: string;
  userAgent: string;
  rawPayload: Record<string, unknown>;
  // idempotency-key of the lead-created call to n8n: created once with the lead and stored with
  // it, so a re-drive reuses it. null for the seeded rows, which never went through the form.
  n8nIdempotencyKey: string | null;
  internalNotes: string;
  createdAt: string;
  updatedAt: string;
};

// What the dashboard list sends to the browser: only the fields the table and the search
// use (the search also matches on e-mail). Full rows carry phone, IP, user agent, raw
// form payload and internal notes.
export type LeadListItem = Pick<Lead, "id" | "fullName" | "company" | "email" | "status" | "createdAt">;

export type NewLead = Omit<
  Lead,
  | "id"
  | "fullName"
  | "status"
  | "score"
  | "assignedTo"
  | "tags"
  | "internalNotes"
  | "createdAt"
  | "updatedAt"
>;

export type User = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "manager";
  workspaceSlug: string;
};

export type Workspace = {
  id: string;
  slug: string;
  name: string;
  plan: "starter" | "growth";
  timezone: string;
};

export type LeadStats = {
  total: number;
  byStatus: Record<LeadStatus, number>;
  last7Days: number;
  conversionRate: number;
  averageBudget: number;
};

export type SourceCount = {
  source: LeadSource;
  count: number;
};

export const QUOTE_STATUSES = ["queued", "processing", "ready", "failed"] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export type Quote = {
  id: string; // random UUID; also the idempotency-key of the quote-request call to n8n
  correlationId: string;
  company: string;
  email: string;
  description: string;
  budget: number | null;
  status: QuoteStatus;
  jobId: string | null;
  documentUrl: string | null;
  failureCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NewQuote = Pick<Quote, "company" | "email" | "description" | "budget">;

export type AuditEntry = {
  action: string;
  leadId: string;
  at: string;
};
