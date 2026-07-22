ALTER TABLE "track_tournament" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "track_tournament_result" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "graphql_select_visible_track_tournament" ON "track_tournament";--> statement-breakpoint
CREATE POLICY "graphql_select_visible_track_tournament" ON "track_tournament" AS PERMISSIVE FOR SELECT TO "zeepcentraal_graphql" USING (EXISTS (
				SELECT 1 FROM public.level AS graphql_visible_level
				WHERE graphql_visible_level.id = "track_tournament"."id_level"
					AND graphql_visible_level.publicly_visible = true
			));--> statement-breakpoint
DROP POLICY IF EXISTS "graphql_select_visible_track_tournament_result" ON "track_tournament_result";--> statement-breakpoint
CREATE POLICY "graphql_select_visible_track_tournament_result" ON "track_tournament_result" AS PERMISSIVE FOR SELECT TO "zeepcentraal_graphql" USING (
				EXISTS (
					SELECT 1
					FROM public.track_tournament AS visible_tournament
					INNER JOIN public.level AS graphql_visible_level
						ON graphql_visible_level.id = visible_tournament.id_level
						AND graphql_visible_level.publicly_visible = true
					WHERE visible_tournament.id = "track_tournament_result"."id_tournament"
				)
				AND EXISTS (
					SELECT 1
					FROM public.record AS graphql_visible_record
					INNER JOIN public.level AS graphql_record_level
						ON graphql_record_level.id = graphql_visible_record.id_level
						AND graphql_record_level.publicly_visible = true
					WHERE graphql_visible_record.id = "track_tournament_result"."id_record"
				)
			);
