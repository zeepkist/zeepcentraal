UPDATE public.level_item SET deleted=true,date_updated=clock_timestamp() WHERE workshop_id=$1 AND file_uid=$2 AND id_level<>$3 AND NOT deleted RETURNING id_level
