SELECT jsonb_array_length(payload->'changes') FROM public.discord_activity_event ORDER BY id DESC LIMIT 1
