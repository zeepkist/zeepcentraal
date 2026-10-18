CREATE INDEX CONCURRENTLY "IX_record_history_user_level_value_contributing"
ON zc_private.record_history_index (history_view, user_id, level_points DESC NULLS FIRST, date_created DESC NULLS FIRST, id DESC NULLS FIRST) WHERE has_contribution;
