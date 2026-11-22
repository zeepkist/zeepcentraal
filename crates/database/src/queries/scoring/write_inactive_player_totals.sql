
                      WITH totals AS (SELECT * FROM jsonb_to_recordset($2::jsonb) input(id_user integer,total_points integer)),
                      inactive AS (SELECT u.id,t.total_points FROM public."user" u JOIN totals t ON t.id_user=u.id
                        WHERE u.id=ANY($1) AND (u.banned OR NOT EXISTS(SELECT 1 FROM public.record r
                          WHERE r.id_user=u.id AND r.date_created>=statement_timestamp()-interval '6 months'
                          AND r.record_eligible)))
                      INSERT INTO public.user_points(id_user,points,total_points,rank,date_created,date_updated)
                      SELECT id,0,total_points,-1,clock_timestamp(),clock_timestamp()
                      FROM inactive ON CONFLICT(id_user) DO UPDATE SET points=0,total_points=excluded.total_points,
                        rank=-1,date_updated=excluded.date_updated
                      WHERE ROW(user_points.points,user_points.total_points,user_points.rank)
                        IS DISTINCT FROM ROW(0,excluded.total_points,-1)
