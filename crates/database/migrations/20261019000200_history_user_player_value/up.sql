CREATE INDEX CONCURRENTLY "IX_record_history_user_player_value_contributing"
ON zc_private.record_history_index (history_view, user_id, player_decayed_points DESC NULLS FIRST, date_created DESC NULLS FIRST, id DESC NULLS FIRST) WHERE has_contribution;
