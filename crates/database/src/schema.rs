//! Generated from packages/database/drizzle/meta/0086_snapshot.json.
//! Regenerate with tools/rust-migration/generate-diesel-schema.py.

pub const DRIZZLE_SNAPSHOT_SHA256: &str =
    "019e66dc5c461c988229803008f33654c37a5a27581d6c8a81df34f871433e57";
pub const DRIZZLE_TABLE_COUNT: usize = 53;
pub const DRIZZLE_VIEW_COUNT: usize = 1;
pub const DRIZZLE_COLUMN_COUNT: usize = 535;

diesel::table! {
    auth (id) {
        id -> Integer,
        id_user -> Nullable<Integer>,
        access_token -> Nullable<Text>,
        access_token_expiry -> Nullable<BigInt>,
        refresh_token -> Nullable<Text>,
        refresh_token_hash -> Nullable<Text>,
        refresh_token_expiry -> Nullable<BigInt>,
        r#type -> Nullable<Integer>,
        provider -> Varchar,
        date_created -> Timestamptz,
        date_updated -> Nullable<Timestamptz>,
    }
}

diesel::table! {
    discord_activity_event (id) {
        id -> BigInt,
        kind -> Text,
        id_level -> Nullable<Integer>,
        id_user -> Nullable<Integer>,
        id_previous_user -> Nullable<Integer>,
        id_record -> Nullable<Integer>,
        id_previous_record -> Nullable<Integer>,
        payload -> Jsonb,
        occurred_at -> Timestamptz,
        date_created -> Timestamptz,
    }
}

diesel::table! {
    favourite (id_user, id_level) {
        id_user -> Integer,
        date_created -> Timestamptz,
        date_updated -> Nullable<Timestamptz>,
        id_level -> Integer,
    }
}

diesel::table! {
    level (id) {
        id -> Integer,
        hash -> Text,
        xx_hash -> Text,
        adventure -> Bool,
        has_records -> Bool,
        record_count -> BigInt,
        publicly_visible -> Bool,
        date_created -> Timestamptz,
        date_updated -> Nullable<Timestamptz>,
    }
}

diesel::table! {
    level_item (id) {
        id -> Integer,
        id_level -> Integer,
        workshop_id -> BigInt,
        author_id -> BigInt,
        name -> Text,
        image_url -> Text,
        file_author -> Text,
        file_uid -> Text,
        validation_time_author -> Float,
        validation_time_gold -> Float,
        validation_time_silver -> Float,
        validation_time_bronze -> Float,
        deleted -> Bool,
        publicly_visible -> Bool,
        rtm_sample_key -> Double,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
        date_created -> Timestamptz,
        date_updated -> Nullable<Timestamptz>,
    }
}

diesel::table! {
    level_metadata (id) {
        id -> Integer,
        id_level -> Integer,
        amount_checkpoints -> Integer,
        amount_finishes -> Integer,
        amount_blocks -> Integer,
        type_ground -> Integer,
        type_skybox -> Integer,
        format -> Integer,
        blocks -> Jsonb,
        publicly_visible -> Bool,
        date_created -> Timestamptz,
        date_updated -> Nullable<Timestamptz>,
    }
}

diesel::table! {
    level_points (id_level) {
        id_level -> Integer,
        points -> Integer,
        rating -> Float,
        modifier_length -> Float,
        modifier_evidence -> Float,
        modifier_quality -> Float,
        modifier_rating -> Float,
        complexity_confidence -> Nullable<Float>,
        complexity_score -> Nullable<Float>,
        field_strength -> Nullable<Float>,
        quality_score -> Nullable<Float>,
        skill_alignment -> Nullable<Float>,
        skill_confidence -> Nullable<Float>,
        skill_sample_size -> Nullable<Integer>,
        skill_score -> Nullable<Float>,
        skill_separation -> Nullable<Float>,
        date_created -> Timestamptz,
        date_updated -> Nullable<Timestamptz>,
    }
}

diesel::table! {
    level_points_history (id) {
        id -> Integer,
        id_level -> Integer,
        points -> Integer,
        rating -> Float,
        modifier_length -> Float,
        modifier_evidence -> Float,
        modifier_quality -> Float,
        modifier_rating -> Float,
        complexity_confidence -> Nullable<Float>,
        complexity_score -> Nullable<Float>,
        field_strength -> Nullable<Float>,
        quality_score -> Nullable<Float>,
        skill_alignment -> Nullable<Float>,
        skill_confidence -> Nullable<Float>,
        skill_sample_size -> Nullable<Integer>,
        skill_score -> Nullable<Float>,
        skill_separation -> Nullable<Float>,
        date_created -> Timestamptz,
        date_updated -> Nullable<Timestamptz>,
    }
}

diesel::table! {
    level_request (id) {
        id -> Integer,
        workshop_id -> BigInt,
        uid -> Nullable<Text>,
        hash -> Nullable<Text>,
        date_created -> Timestamptz,
        date_updated -> Nullable<Timestamptz>,
    }
}

diesel::table! {
    lobby (id) {
        id -> BigInt,
        master_id -> Text,
        room_name -> Text,
        host_id -> BigInt,
        players -> Integer,
        player_limit -> Integer,
        is_public -> Bool,
        peak_players -> Integer,
        peak_time -> Timestamptz,
        first_seen -> Timestamptz,
        last_seen -> Timestamptz,
        closed_at -> Nullable<Timestamptz>,
        date_created -> Timestamptz,
        date_updated -> Timestamptz,
    }
}

diesel::table! {
    lobby_history (id) {
        id -> BigInt,
        lobby_id -> BigInt,
        host_id -> BigInt,
        change_type -> Text,
        room_name -> Text,
        players -> Integer,
        player_limit -> Integer,
        is_public -> Bool,
        observed_at -> Timestamptz,
        date_created -> Timestamptz,
    }
}

diesel::table! {
    lobby_stats (id) {
        id -> BigInt,
        players -> Integer,
        rooms -> Integer,
        players_in_rooms -> Integer,
        date_created -> Timestamptz,
        date_updated -> Timestamptz,
    }
}

diesel::table! {
    personal_best_global (id) {
        id -> Integer,
        id_record -> Integer,
        id_user -> Integer,
        id_level -> Integer,
        date_created -> Timestamptz,
        date_updated -> Nullable<Timestamptz>,
    }
}

diesel::table! {
    player_skill_aggregate (id_user) {
        id_user -> Integer,
        placement_sum -> Double,
        eligible_level_count -> Integer,
        skill -> Float,
        date_updated -> Timestamptz,
    }
}

diesel::table! {
    record (id) {
        id -> Integer,
        id_user -> Integer,
        time -> Float,
        game_version -> Varchar,
        id_level -> Integer,
        mod_version -> Varchar,
        splits -> Nullable<Array<Float>>,
        speeds -> Nullable<Array<Float>>,
        date_created -> Timestamptz,
        date_updated -> Nullable<Timestamptz>,
    }
}

diesel::table! {
    record_media (id_record) {
        id_record -> Integer,
        ghost_url -> Nullable<Text>,
        date_created -> Timestamptz,
        date_updated -> Nullable<Timestamptz>,
    }
}

diesel::table! {
    #[sql_name = "record_statistic"]
    record_statistic_part_1 (id_record) {
        id_record -> Integer,
        ghost_version -> Nullable<Integer>,
        has_input_data -> Nullable<Bool>,
        has_air_data -> Nullable<Bool>,
        has_wheel_data -> Nullable<Bool>,
        has_slip_data -> Nullable<Bool>,
        has_state_data -> Nullable<Bool>,
        has_surface_data -> Nullable<Bool>,
        has_velocity_data -> Nullable<Bool>,
        has_ragdoll_data -> Nullable<Bool>,
        time_any_driver_input -> Nullable<Float>,
        driver_input_transition_count -> Nullable<Integer>,
        frame_count -> Nullable<Integer>,
        time -> Nullable<Float>,
        distance -> Nullable<Float>,
        distance_in_air -> Nullable<Float>,
        distance_on_ground -> Nullable<Float>,
        distance_on_1_wheel -> Nullable<Float>,
        distance_on_2_wheels -> Nullable<Float>,
        distance_on_3_wheels -> Nullable<Float>,
        distance_on_4_wheels -> Nullable<Float>,
        time_in_air -> Nullable<Float>,
        time_on_ground -> Nullable<Float>,
        time_on_1_wheel -> Nullable<Float>,
        time_on_2_wheels -> Nullable<Float>,
        time_on_3_wheels -> Nullable<Float>,
        time_on_4_wheels -> Nullable<Float>,
        average_speed -> Nullable<Float>,
        max_speed -> Nullable<Float>,
        arms_up_count -> Nullable<Integer>,
        arms_up_time -> Nullable<Float>,
        brake_count -> Nullable<Integer>,
    }
}

diesel::table! {
    #[sql_name = "record_statistic"]
    record_statistic_part_2 (id_record) {
        id_record -> Integer,
        brake_time -> Nullable<Float>,
        turn_left_count -> Nullable<Integer>,
        turn_left_time -> Nullable<Float>,
        turn_right_count -> Nullable<Integer>,
        turn_right_time -> Nullable<Float>,
        horn_count -> Nullable<Integer>,
        horn_time -> Nullable<Float>,
        distance_slipping -> Nullable<Float>,
        distance_paraglider -> Nullable<Float>,
        distance_offroad_wheels -> Nullable<Float>,
        distance_soap_wheels -> Nullable<Float>,
        distance_on_monorail -> Nullable<Float>,
        distance_parked -> Nullable<Float>,
        distance_ragdoll -> Nullable<Float>,
        time_slipping -> Nullable<Float>,
        time_paraglider -> Nullable<Float>,
        time_offroad_wheels -> Nullable<Float>,
        time_soap_wheels -> Nullable<Float>,
        time_on_monorail -> Nullable<Float>,
        time_parked -> Nullable<Float>,
        time_ragdoll -> Nullable<Float>,
        distance_on_tarmac -> Nullable<Float>,
        distance_on_grass -> Nullable<Float>,
        distance_on_sand -> Nullable<Float>,
        distance_on_ice1 -> Nullable<Float>,
        distance_on_ice2 -> Nullable<Float>,
        distance_on_ice3 -> Nullable<Float>,
        distance_on_soap -> Nullable<Float>,
        distance_on_wood -> Nullable<Float>,
        distance_on_mud -> Nullable<Float>,
        time_on_tarmac -> Nullable<Float>,
    }
}

diesel::table! {
    #[sql_name = "record_statistic"]
    record_statistic_part_3 (id_record) {
        id_record -> Integer,
        time_on_grass -> Nullable<Float>,
        time_on_sand -> Nullable<Float>,
        time_on_ice1 -> Nullable<Float>,
        time_on_ice2 -> Nullable<Float>,
        time_on_ice3 -> Nullable<Float>,
        time_on_soap -> Nullable<Float>,
        time_on_wood -> Nullable<Float>,
        time_on_mud -> Nullable<Float>,
        average_velocity -> Nullable<Float>,
        max_velocity -> Nullable<Float>,
        average_angular_velocity -> Nullable<Float>,
        max_angular_velocity -> Nullable<Float>,
        average_gforce -> Nullable<Float>,
        max_gforce -> Nullable<Float>,
        date_created -> Timestamptz,
        date_updated -> Nullable<Timestamptz>,
    }
}

diesel::table! {
    track_tournament (id) {
        id -> Integer,
        r#type -> Integer,
        slug -> Text,
        id_level -> Integer,
        start_at -> Timestamptz,
        end_at -> Timestamptz,
        finalized_at -> Nullable<Timestamptz>,
        points_version -> Integer,
        date_created -> Timestamptz,
        date_updated -> Nullable<Timestamptz>,
    }
}

diesel::table! {
    track_tournament_result (id_tournament, id_user) {
        id_tournament -> Integer,
        id_user -> Integer,
        id_record -> Integer,
        time -> Float,
        rank -> Integer,
        points -> Integer,
        date_created -> Timestamptz,
        date_updated -> Nullable<Timestamptz>,
    }
}

diesel::table! {
    user (id) {
        id -> Integer,
        steam_name -> Nullable<Varchar>,
        banned -> Bool,
        steam_id -> Nullable<BigInt>,
        discord_id -> Nullable<BigInt>,
        date_created -> Timestamptz,
        date_updated -> Nullable<Timestamptz>,
    }
}

diesel::table! {
    user_point_contribution (id_user, id_level) {
        id_user -> Integer,
        id_level -> Integer,
        id_record -> Integer,
        contribution_rank -> Integer,
        level_position -> Integer,
        level_points -> Integer,
        level_decayed_points -> Float,
        player_decayed_points -> Float,
        date_calculated -> Timestamptz,
    }
}

diesel::table! {
    user_points (id_user) {
        id_user -> Integer,
        points -> Integer,
        total_points -> Integer,
        rank -> Integer,
        world_records -> Integer,
        date_created -> Timestamptz,
        date_updated -> Nullable<Timestamptz>,
    }
}

diesel::table! {
    user_points_history (id) {
        id -> Integer,
        id_user -> Integer,
        points -> Integer,
        total_points -> Integer,
        rank -> Integer,
        world_records -> Integer,
        date_created -> Timestamptz,
        date_updated -> Nullable<Timestamptz>,
    }
}

diesel::table! {
    version (id) {
        id -> Integer,
        minimum -> Nullable<Text>,
        latest -> Nullable<Text>,
        date_created -> Timestamptz,
        date_updated -> Nullable<Timestamptz>,
    }
}

diesel::table! {
    vote (id_user, id_level) {
        id_user -> Integer,
        id_level -> Integer,
        value -> Integer,
        date_created -> Timestamptz,
        date_updated -> Nullable<Timestamptz>,
    }
}

diesel::table! {
    workshop_item (workshop_id) {
        workshop_id -> BigInt,
        author_id -> BigInt,
        name -> Text,
        image_url -> Text,
        visibility -> SmallInt,
        publicly_visible -> Bool,
        file_size -> Integer,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
        date_created -> Timestamptz,
        date_updated -> Timestamptz,
    }
}

diesel::table! {
    world_record_global (id) {
        id -> Integer,
        id_record -> Integer,
        id_level -> Integer,
        date_created -> Timestamptz,
        date_updated -> Nullable<Timestamptz>,
        id_user -> Integer,
    }
}

diesel::table! {
    zsl_level (id) {
        id -> Integer,
        id_round -> Integer,
        id_level -> Integer,
        date_created -> Timestamptz,
        date_updated -> Nullable<Timestamptz>,
    }
}

diesel::table! {
    zsl_level_result (id_level, id_user) {
        id_level -> Integer,
        id_user -> Integer,
        id_record -> Nullable<Integer>,
        position -> Integer,
        points -> Integer,
        time -> Float,
        date_created -> Timestamptz,
        date_updated -> Nullable<Timestamptz>,
    }
}

diesel::table! {
    zsl_points_structure (id) {
        id -> Integer,
        name -> Text,
        points -> Array<Integer>,
        minimum_points -> Integer,
        best_of -> Integer,
        date_created -> Timestamptz,
        date_updated -> Nullable<Timestamptz>,
    }
}

diesel::table! {
    zsl_round (id) {
        id -> Integer,
        id_season -> Integer,
        name -> Text,
        round -> Integer,
        workshop_id -> BigInt,
        event_date -> Timestamptz,
        date_created -> Timestamptz,
        date_updated -> Nullable<Timestamptz>,
    }
}

diesel::table! {
    zsl_round_result (id_round, id_user) {
        id_round -> Integer,
        id_user -> Integer,
        position -> Integer,
        points -> Integer,
        date_created -> Timestamptz,
        date_updated -> Nullable<Timestamptz>,
    }
}

diesel::table! {
    zsl_season (id) {
        id -> Integer,
        id_points_structure -> Integer,
        name -> Text,
        start_date -> Timestamptz,
        end_date -> Timestamptz,
        date_created -> Timestamptz,
        date_updated -> Nullable<Timestamptz>,
    }
}

diesel::table! {
    zsl_season_result (id_season, id_user) {
        id_season -> Integer,
        id_user -> Integer,
        position -> Integer,
        points -> Integer,
        date_created -> Timestamptz,
        date_updated -> Nullable<Timestamptz>,
    }
}

diesel::table! {
    zc_private.discord_delivery (guild_id, event_id) {
        guild_id -> BigInt,
        event_id -> BigInt,
        channel_id -> BigInt,
        message_id -> Nullable<BigInt>,
        status -> Text,
        last_error -> Nullable<Text>,
        date_updated -> Timestamptz,
    }
}

diesel::table! {
    zc_private.discord_digest (guild_id) {
        guild_id -> BigInt,
        channel_id -> BigInt,
        daily_enabled -> Bool,
        weekly_enabled -> Bool,
        delivery_hour -> Integer,
        weekly_day -> Integer,
        next_delivery_at -> Nullable<Timestamptz>,
        lease_until -> Nullable<Timestamptz>,
        date_updated -> Timestamptz,
    }
}

diesel::table! {
    zc_private.discord_guild_config (guild_id) {
        guild_id -> BigInt,
        linked_role_id -> Nullable<BigInt>,
        date_created -> Timestamptz,
        date_updated -> Timestamptz,
    }
}

diesel::table! {
    zc_private.discord_guild_feed (guild_id, kind) {
        guild_id -> BigInt,
        kind -> Text,
        channel_id -> BigInt,
        enabled -> Bool,
        cursor_event_id -> BigInt,
        date_created -> Timestamptz,
        date_updated -> Timestamptz,
    }
}

diesel::table! {
    zc_private.discord_link_code (code_hash) {
        code_hash -> Text,
        id_user -> Integer,
        expires_at -> Timestamptz,
        attempts -> Integer,
        consumed_at -> Nullable<Timestamptz>,
        date_created -> Timestamptz,
    }
}

diesel::table! {
    zc_private.discord_oauth_link_state (state_hash) {
        state_hash -> Text,
        id_user -> Integer,
        expires_at -> Timestamptz,
        consumed_at -> Nullable<Timestamptz>,
        date_created -> Timestamptz,
    }
}

diesel::table! {
    zc_private.discord_tournament_message (guild_id, id_tournament) {
        guild_id -> BigInt,
        id_tournament -> Integer,
        channel_id -> BigInt,
        message_id -> BigInt,
        content_hash -> Text,
        date_updated -> Timestamptz,
    }
}

diesel::table! {
    zc_private.discord_user_preference (discord_id) {
        discord_id -> BigInt,
        ping_on_world_record_loss -> Bool,
        date_updated -> Timestamptz,
    }
}

diesel::table! {
    zc_private.discord_watch (id) {
        id -> BigInt,
        discord_id -> BigInt,
        kind -> Text,
        target_id -> Text,
        paused -> Bool,
        last_error -> Nullable<Text>,
        last_delivery_key -> Nullable<Text>,
        date_created -> Timestamptz,
        date_updated -> Timestamptz,
    }
}

diesel::table! {
    zc_private.discord_worker_state (key) {
        key -> Text,
        cursor_event_id -> BigInt,
        date_updated -> Timestamptz,
    }
}

diesel::table! {
    zc_private.level_submission_contest (id) {
        id -> BigInt,
        thread_id -> Text,
        guild_id -> Text,
        forum_id -> Text,
        title -> Text,
        theme -> Text,
        season_number -> Integer,
        round_number -> Integer,
        id_zsl_round -> Nullable<Integer>,
        mapping_source -> Text,
        state -> Text,
        rules -> Jsonb,
        rules_hash -> Text,
        last_complete_scan -> Nullable<Timestamptz>,
        frozen_at -> Nullable<Timestamptz>,
        current_playlist_id -> Nullable<BigInt>,
        publication -> Jsonb,
        date_created -> Timestamptz,
        date_updated -> Timestamptz,
    }
}

diesel::table! {
    zc_private.level_submission_playlist (id) {
        id -> BigInt,
        id_contest -> BigInt,
        digest -> Text,
        valid_count -> Integer,
        object_key -> Text,
        date_created -> Timestamptz,
    }
}

diesel::table! {
    zc_private.level_submission_playlist_entry (id) {
        id -> BigInt,
        id_playlist -> BigInt,
        position -> Integer,
        id_validation -> BigInt,
        workshop_id -> BigInt,
    }
}

diesel::table! {
    zc_private.level_submission_validation (id) {
        id -> BigInt,
        id_submission -> BigInt,
        workshop_updated_at -> Text,
        workshop_file_size -> BigInt,
        content_sha256 -> Nullable<Text>,
        validator_version -> Text,
        rules_hash -> Text,
        id_level_item -> Nullable<Integer>,
        file_uid -> Nullable<Text>,
        measurements -> Jsonb,
        failures -> Jsonb,
        valid -> Bool,
        payload -> Nullable<Jsonb>,
        date_created -> Timestamptz,
    }
}

diesel::table! {
    zc_private.level_submissions (id) {
        id -> BigInt,
        id_contest -> BigInt,
        message_id -> Text,
        author_id -> Text,
        workshop_id -> BigInt,
        message_created_at -> Timestamptz,
        message_edited_at -> Nullable<Timestamptz>,
        state -> Text,
        source_error -> Nullable<Text>,
        last_seen -> Timestamptz,
        latest_validation_id -> Nullable<BigInt>,
        retry_category -> Nullable<Text>,
        date_created -> Timestamptz,
        date_updated -> Timestamptz,
    }
}

diesel::table! {
    zc_private.managed_lobby (key) {
        key -> Text,
        join_id -> Text,
        date_created -> Timestamptz,
        date_updated -> Timestamptz,
    }
}

diesel::table! {
    zc_private.points_history_prune_state (history) {
        history -> Text,
        week_start -> Timestamptz,
        budget_date -> Date,
        deleted_today -> Integer,
        date_updated -> Timestamptz,
    }
}

diesel::table! {
    zc_private.record_history_index (history_view, id) {
        history_view -> Text,
        id -> Integer,
        time -> Float,
        date_created -> Timestamptz,
        level_id -> Integer,
        user_id -> Integer,
        level_position -> Nullable<Integer>,
        contribution_rank -> Nullable<Integer>,
        level_points -> Nullable<Integer>,
        level_decayed_points -> Nullable<Float>,
        player_decayed_points -> Nullable<Float>,
        is_personal_best -> Bool,
        is_world_record -> Bool,
        has_contribution -> Bool,
    }
}

diesel::table! {
    zc_private.track_tournament_lobby_asset (id_tournament) {
        id_tournament -> Integer,
        workshop_id -> BigInt,
        file_uid -> Text,
        level_name -> Text,
        author -> Text,
        collaborators -> Text,
        override_author_name -> Text,
        object_key -> Text,
        content_sha256 -> Text,
        byte_size -> Integer,
        date_created -> Timestamptz,
        date_updated -> Timestamptz,
    }
}

diesel::table! {
    public.record_history_entry (history_view, id) {
        history_view -> Text,
        id -> Integer,
        time -> Float,
        date_created -> Timestamptz,
        level_id -> Integer,
        user_id -> Integer,
        user_steam_id -> Nullable<BigInt>,
        user_name -> Nullable<Varchar>,
        level_xx_hash -> Text,
        level_name -> Nullable<Text>,
        level_position -> Nullable<Integer>,
        contribution_rank -> Nullable<Integer>,
        level_points -> Nullable<Integer>,
        level_decayed_points -> Nullable<Float>,
        player_decayed_points -> Nullable<Float>,
        is_personal_best -> Bool,
        is_world_record -> Bool,
        has_contribution -> Bool,
    }
}
