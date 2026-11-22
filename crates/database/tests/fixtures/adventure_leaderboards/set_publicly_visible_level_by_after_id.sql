
      UPDATE public.level SET publicly_visible=true;
      UPDATE public.level_item SET deleted=false;
      INSERT INTO public."user" SELECT i,false FROM generate_series(1000,2999) i;
      INSERT INTO public.record
       SELECT 1000+(u-1000)*18+l,u,l,10+l::real/100,true
       FROM generate_series(1000,2999) u CROSS JOIN generate_series(1,18) l;
      INSERT INTO public.personal_best_global SELECT id_user,id_level,id,true FROM public.record WHERE id>=1000;
      INSERT INTO public.record SELECT 1000000+i,1,19,100,true FROM generate_series(1,200000) i;
      CREATE INDEX fixture_pb_level_user ON public.personal_best_global(id_level,id_user);
      ANALYZE public.record; ANALYZE public.personal_best_global; ANALYZE public.level_item;
      ANALYZE public.level; ANALYZE public."user";
      SET LOCAL ROLE zeepcentraal_graphql;
