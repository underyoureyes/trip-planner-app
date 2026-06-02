-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id            uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text        NOT NULL DEFAULT '',
  home_tow1n     text,
  vehicle_name  text,
  vehicle_type  text        CHECK (vehicle_type IN ('car', 'campervan', 'motorhome', 'motorcycle')),
  is_admin      boolean     NOT NULL DEFAULT false,
  setup_complete boolean    NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id       uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  claude_api_key text,
  distance_unit text        NOT NULL DEFAULT 'metric' CHECK (distance_unit IN ('metric', 'imperial')),
  currency      text        NOT NULL DEFAULT 'GBP',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trips (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         text        NOT NULL,
  status        text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'ready', 'error')),
  start_date    date,
  end_date      date,
  is_shared     boolean     NOT NULL DEFAULT false,
  intake_form   jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trip_data (
  trip_id       uuid        PRIMARY KEY REFERENCES public.trips(id) ON DELETE CASCADE,
  data          jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invite_codes (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text        NOT NULL UNIQUE,
  used_by       uuid        REFERENCES auth.users(id),
  used_at       timestamptz,
  revoked       boolean     NOT NULL DEFAULT false,
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '1 year'),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Default invite code
INSERT INTO public.invite_codes (code)
VALUES ('TRIPPLAN2026')
ON CONFLICT (code) DO NOTHING;

-- ── Trigger: create profile row on signup ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Row Level Security ─────────────────────────────────────────────────────────

ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_data    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- user_settings
DROP POLICY IF EXISTS "settings_select" ON public.user_settings;
DROP POLICY IF EXISTS "settings_insert" ON public.user_settings;
DROP POLICY IF EXISTS "settings_update" ON public.user_settings;
CREATE POLICY "settings_select" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "settings_insert" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "settings_update" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);

-- trips
DROP POLICY IF EXISTS "trips_select" ON public.trips;
DROP POLICY IF EXISTS "trips_insert" ON public.trips;
DROP POLICY IF EXISTS "trips_update" ON public.trips;
DROP POLICY IF EXISTS "trips_delete" ON public.trips;
CREATE POLICY "trips_select" ON public.trips FOR SELECT USING (auth.uid() = owner_id OR is_shared = true);
CREATE POLICY "trips_insert" ON public.trips FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "trips_update" ON public.trips FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "trips_delete" ON public.trips FOR DELETE USING (auth.uid() = owner_id);

-- trip_data
DROP POLICY IF EXISTS "trip_data_select" ON public.trip_data;
DROP POLICY IF EXISTS "trip_data_insert" ON public.trip_data;
DROP POLICY IF EXISTS "trip_data_update" ON public.trip_data;
CREATE POLICY "trip_data_select" ON public.trip_data FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.trips WHERE trips.id = trip_data.trip_id AND (trips.owner_id = auth.uid() OR trips.is_shared = true))
);
CREATE POLICY "trip_data_insert" ON public.trip_data FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.trips WHERE trips.id = trip_data.trip_id AND trips.owner_id = auth.uid())
);
CREATE POLICY "trip_data_update" ON public.trip_data FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.trips WHERE trips.id = trip_data.trip_id AND trips.owner_id = auth.uid())
);

-- invite_codes (anyone authenticated can read to validate; authenticated users can mark as used)
DROP POLICY IF EXISTS "invite_codes_select" ON public.invite_codes;
DROP POLICY IF EXISTS "invite_codes_update" ON public.invite_codes;
CREATE POLICY "invite_codes_select" ON public.invite_codes FOR SELECT USING (true);
CREATE POLICY "invite_codes_update" ON public.invite_codes FOR UPDATE USING (auth.uid() IS NOT NULL);
