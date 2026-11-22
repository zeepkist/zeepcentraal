ALTER TABLE public.level_item ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now()
