DELETE FROM public.personal_best_global pb WHERE pb.id_level=$1 AND NOT EXISTS(SELECT 1 FROM eligible_record_winners w WHERE w.id_user=pb.id_user)
