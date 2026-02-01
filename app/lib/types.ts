export type CrmEntry = {
  contact_name: string | null;
  company_name: string | null;
  deal_value_usd: number | null;
  sentiment: string | null;
  next_step: string | null;
  follow_up_date: string | null;
  full_summary: string | null;
  at_risk: boolean | null;
  transcript: string | null;
  created_at: string | null;
};

export type ApiError = { error: string; details?: string };
