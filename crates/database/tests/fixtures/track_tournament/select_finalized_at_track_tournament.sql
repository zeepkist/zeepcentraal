SELECT finalized_at=$2::text::timestamptz AND date_updated=$2::text::timestamptz AS value FROM public.track_tournament WHERE id=$1
