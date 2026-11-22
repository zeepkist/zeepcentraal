BEGIN; INSERT INTO public.record_media(id_record,ghost_url) VALUES(1,'fixture-ghost') ON CONFLICT(id_record) DO UPDATE SET ghost_url=excluded.ghost_url;
