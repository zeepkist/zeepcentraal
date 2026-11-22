UPDATE public.workshop_item SET visibility=$2,date_updated=clock_timestamp() WHERE workshop_id=$1
