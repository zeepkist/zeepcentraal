INSERT INTO public.level(publicly_visible,date_created) VALUES(true,$1::text::timestamptz-interval '1 day')
