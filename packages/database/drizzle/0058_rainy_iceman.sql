CREATE INDEX "IX_level_item_public_level_updated_active" ON "level_item" USING btree ("id_level","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "level_item"."publicly_visible" = true AND "level_item"."deleted" = false;--> statement-breakpoint
CREATE INDEX "IX_user_point_contribution_player_value_record" ON "user_point_contribution" USING btree ("player_decayed_points" DESC NULLS LAST,"id_record" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "IX_user_point_contribution_level_value_record" ON "user_point_contribution" USING btree ("level_points" DESC NULLS LAST,"id_record" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "IX_user_point_contribution_user_level_value_record" ON "user_point_contribution" USING btree ("id_user","level_points" DESC NULLS LAST,"id_record" DESC NULLS LAST);--> statement-breakpoint
CREATE VIEW "public"."record_history_entry" WITH (security_invoker = true) AS (
		
	SELECT
		'recent'::text AS history_view,
		submitted_record.id,
		submitted_record.time,
		submitted_record.date_created,
		submitted_record.id_level AS level_id,
		submitted_record.id_user AS user_id,
		record_user.steam_id AS user_steam_id,
		record_user.steam_name AS user_name,
		record_level.xx_hash AS level_xx_hash,
		visible_level_item.name AS level_name,
		contribution.level_position,
		contribution.contribution_rank,
		COALESCE(contribution.level_points, current_level_points.points) AS level_points,
		contribution.level_decayed_points,
		contribution.player_decayed_points,
		EXISTS (
			SELECT 1
			FROM public.personal_best_global AS current_personal_best
			WHERE current_personal_best.id_record = submitted_record.id
		) AS is_personal_best,
		EXISTS (
			SELECT 1
			FROM public.world_record_global AS current_world_record
			WHERE current_world_record.id_record = submitted_record.id
		) AS is_world_record,
		(contribution.id_record IS NOT NULL) AS has_contribution
	
			FROM public.record AS submitted_record
		
	INNER JOIN public."user" AS record_user ON record_user.id = submitted_record.id_user
	INNER JOIN public.level AS record_level ON record_level.id = submitted_record.id_level
	LEFT JOIN public.level_points AS current_level_points
		ON current_level_points.id_level = submitted_record.id_level
	LEFT JOIN LATERAL (
		SELECT
			candidate_contribution.id_record,
			candidate_contribution.level_position,
			candidate_contribution.contribution_rank,
			candidate_contribution.level_points,
			candidate_contribution.level_decayed_points,
			candidate_contribution.player_decayed_points
		FROM public.user_point_contribution AS candidate_contribution
		WHERE candidate_contribution.id_record = submitted_record.id
		LIMIT 1
	) AS contribution ON true
	LEFT JOIN LATERAL (
		SELECT candidate_level_item.name
		FROM public.level_item AS candidate_level_item
		WHERE candidate_level_item.id_level = submitted_record.id_level
			AND candidate_level_item.publicly_visible = true
			AND candidate_level_item.deleted = false
		ORDER BY candidate_level_item.updated_at DESC, candidate_level_item.id DESC
		LIMIT 1
	) AS visible_level_item ON true

		UNION ALL
		
	SELECT
		'personal-bests'::text AS history_view,
		submitted_record.id,
		submitted_record.time,
		submitted_record.date_created,
		submitted_record.id_level AS level_id,
		submitted_record.id_user AS user_id,
		record_user.steam_id AS user_steam_id,
		record_user.steam_name AS user_name,
		record_level.xx_hash AS level_xx_hash,
		visible_level_item.name AS level_name,
		contribution.level_position,
		contribution.contribution_rank,
		COALESCE(contribution.level_points, current_level_points.points) AS level_points,
		contribution.level_decayed_points,
		contribution.player_decayed_points,
		EXISTS (
			SELECT 1
			FROM public.personal_best_global AS current_personal_best
			WHERE current_personal_best.id_record = submitted_record.id
		) AS is_personal_best,
		EXISTS (
			SELECT 1
			FROM public.world_record_global AS current_world_record
			WHERE current_world_record.id_record = submitted_record.id
		) AS is_world_record,
		(contribution.id_record IS NOT NULL) AS has_contribution
	
			FROM public.personal_best_global AS history_personal_best
			INNER JOIN public.record AS submitted_record
				ON submitted_record.id = history_personal_best.id_record
		
	INNER JOIN public."user" AS record_user ON record_user.id = submitted_record.id_user
	INNER JOIN public.level AS record_level ON record_level.id = submitted_record.id_level
	LEFT JOIN public.level_points AS current_level_points
		ON current_level_points.id_level = submitted_record.id_level
	LEFT JOIN LATERAL (
		SELECT
			candidate_contribution.id_record,
			candidate_contribution.level_position,
			candidate_contribution.contribution_rank,
			candidate_contribution.level_points,
			candidate_contribution.level_decayed_points,
			candidate_contribution.player_decayed_points
		FROM public.user_point_contribution AS candidate_contribution
		WHERE candidate_contribution.id_record = submitted_record.id
		LIMIT 1
	) AS contribution ON true
	LEFT JOIN LATERAL (
		SELECT candidate_level_item.name
		FROM public.level_item AS candidate_level_item
		WHERE candidate_level_item.id_level = submitted_record.id_level
			AND candidate_level_item.publicly_visible = true
			AND candidate_level_item.deleted = false
		ORDER BY candidate_level_item.updated_at DESC, candidate_level_item.id DESC
		LIMIT 1
	) AS visible_level_item ON true

		UNION ALL
		
	SELECT
		'world-records'::text AS history_view,
		submitted_record.id,
		submitted_record.time,
		submitted_record.date_created,
		submitted_record.id_level AS level_id,
		submitted_record.id_user AS user_id,
		record_user.steam_id AS user_steam_id,
		record_user.steam_name AS user_name,
		record_level.xx_hash AS level_xx_hash,
		visible_level_item.name AS level_name,
		contribution.level_position,
		contribution.contribution_rank,
		COALESCE(contribution.level_points, current_level_points.points) AS level_points,
		contribution.level_decayed_points,
		contribution.player_decayed_points,
		EXISTS (
			SELECT 1
			FROM public.personal_best_global AS current_personal_best
			WHERE current_personal_best.id_record = submitted_record.id
		) AS is_personal_best,
		EXISTS (
			SELECT 1
			FROM public.world_record_global AS current_world_record
			WHERE current_world_record.id_record = submitted_record.id
		) AS is_world_record,
		(contribution.id_record IS NOT NULL) AS has_contribution
	
			FROM public.world_record_global AS history_world_record
			INNER JOIN public.record AS submitted_record
				ON submitted_record.id = history_world_record.id_record
		
	INNER JOIN public."user" AS record_user ON record_user.id = submitted_record.id_user
	INNER JOIN public.level AS record_level ON record_level.id = submitted_record.id_level
	LEFT JOIN public.level_points AS current_level_points
		ON current_level_points.id_level = submitted_record.id_level
	LEFT JOIN LATERAL (
		SELECT
			candidate_contribution.id_record,
			candidate_contribution.level_position,
			candidate_contribution.contribution_rank,
			candidate_contribution.level_points,
			candidate_contribution.level_decayed_points,
			candidate_contribution.player_decayed_points
		FROM public.user_point_contribution AS candidate_contribution
		WHERE candidate_contribution.id_record = submitted_record.id
		LIMIT 1
	) AS contribution ON true
	LEFT JOIN LATERAL (
		SELECT candidate_level_item.name
		FROM public.level_item AS candidate_level_item
		WHERE candidate_level_item.id_level = submitted_record.id_level
			AND candidate_level_item.publicly_visible = true
			AND candidate_level_item.deleted = false
		ORDER BY candidate_level_item.updated_at DESC, candidate_level_item.id DESC
		LIMIT 1
	) AS visible_level_item ON true

	);--> statement-breakpoint

COMMENT ON VIEW public.record_history_entry IS E'@primaryKey history_view,id\n@behavior -insert -update -delete';--> statement-breakpoint
REVOKE ALL ON TABLE public.record_history_entry FROM PUBLIC;--> statement-breakpoint
GRANT SELECT ON TABLE public.record_history_entry TO zeepcentraal_graphql;
