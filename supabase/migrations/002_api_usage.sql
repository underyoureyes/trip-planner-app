-- Track Claude API token usage per user / per trip

CREATE TABLE IF NOT EXISTS public.api_usage (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id       uuid        REFERENCES public.trips(id) ON DELETE SET NULL,
  endpoint      text        NOT NULL,          -- e.g. 'generate', 'add-stop', 'scan-photo'
  input_tokens  integer     NOT NULL DEFAULT 0,
  output_tokens integer     NOT NULL DEFAULT 0,
  cost_usd      numeric(10,6) NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_usage_user_idx ON public.api_usage (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS api_usage_trip_idx ON public.api_usage (trip_id) WHERE trip_id IS NOT NULL;

ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_usage"   ON public.api_usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_usage" ON public.api_usage FOR INSERT WITH CHECK (auth.uid() = user_id);
