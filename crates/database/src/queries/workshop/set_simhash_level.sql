UPDATE public.level SET simhash=$2,date_updated=clock_timestamp() WHERE id=$1 AND simhash IS NULL
