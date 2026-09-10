ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS daily_quota_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_bulk_enabled boolean NOT NULL DEFAULT true;