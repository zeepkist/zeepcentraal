UPDATE public.lobby SET closed_at=$2::timestamptz,date_updated=$2::timestamptz WHERE id=ANY($1)
