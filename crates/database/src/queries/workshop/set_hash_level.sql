UPDATE public.level SET hash=$2,date_updated=clock_timestamp() WHERE id=$1 AND hash IS DISTINCT FROM $2
