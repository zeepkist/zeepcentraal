
      DELETE FROM public.personal_best_global;
      DELETE FROM public.world_record_global;
      DELETE FROM public.vote;
      UPDATE public.level SET publicly_visible=false;
      UPDATE public."user" SET banned=true;
      UPDATE zc_private.record_validation SET status='fail';
      DELETE FROM public.record WHERE id=4;
      SELECT pg_temp.capture_metrics('2026-10-18 13:00Z');
