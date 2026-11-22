SELECT id,id_level FROM public.track_tournament WHERE type=$1 AND finalized_at IS NULL AND (end_at<=$2::text::timestamptz OR ($3 AND id=$4)) ORDER BY id
