UPDATE public.track_tournament SET finalized_at=$2::text::timestamptz,date_updated=$2::text::timestamptz WHERE type=$1 AND finalized_at IS NULL AND end_at<=$2::text::timestamptz
