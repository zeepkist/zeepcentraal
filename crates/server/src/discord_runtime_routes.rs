use crate::{AppState, auth, problem::Problem};
use axum::{
    Json,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
};
use serde::Deserialize;
use serde_json::Value;
use std::sync::Arc;

type ApiResult<T> = Result<T, Problem>;

#[derive(Deserialize, utoipa::IntoParams)]
#[serde(rename_all = "camelCase")]
pub struct ActivityEventsQuery {
    after: String,
    #[serde(default = "default_activity_limit")]
    limit: i64,
}

fn default_activity_limit() -> i64 {
    100
}

#[derive(Deserialize, utoipa::IntoParams)]
pub struct ProfileQuery {
    kind: String,
}

#[utoipa::path(get, path = "/discord-bot/profiles/{identifier}", params(("identifier" = String, Path), ProfileQuery), responses((status = 200), (status = 400), (status = 401), (status = 404)))]
pub async fn profile(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(identifier): Path<String>,
    Query(query): Query<ProfileQuery>,
) -> ApiResult<Json<Value>> {
    authorize(&state, &headers)?;
    if !matches!(query.kind.as_str(), "discord" | "steam" | "id")
        || identifier.is_empty()
        || identifier.len() > 32
        || !identifier.bytes().all(|byte| byte.is_ascii_digit())
    {
        return Err(invalid());
    }
    state
        .database
        .discord_profile(&query.kind, &identifier)
        .await
        .map_err(Problem::internal)?
        .map(Json)
        .ok_or_else(|| Problem {
            status: StatusCode::NOT_FOUND,
            detail: "Player not found".into(),
            error_code: None,
        })
}

#[derive(Deserialize, utoipa::ToSchema)]
pub struct LevelQueryBody {
    query: String,
}

#[utoipa::path(post, path = "/discord-bot/levels/lookup", request_body = LevelQueryBody, responses((status = 200), (status = 400), (status = 401), (status = 404)))]
pub async fn level_lookup(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<LevelQueryBody>,
) -> ApiResult<Json<Value>> {
    authorize(&state, &headers)?;
    let query = body.query.trim();
    if query.is_empty() || query.len() > 200 {
        return Err(invalid());
    }
    state
        .database
        .discord_level_lookup(query)
        .await
        .map_err(Problem::internal)?
        .map(Json)
        .ok_or_else(not_found)
}

#[utoipa::path(post, path = "/discord-bot/levels/search", request_body = LevelQueryBody, responses((status = 200), (status = 400), (status = 401)))]
pub async fn level_search(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<LevelQueryBody>,
) -> ApiResult<Json<Vec<Value>>> {
    authorize(&state, &headers)?;
    let query = body.query.trim();
    if !(2..=200).contains(&query.len()) {
        return Err(invalid());
    }
    Ok(Json(
        state
            .database
            .discord_level_search(query)
            .await
            .map_err(Problem::internal)?,
    ))
}

#[derive(Deserialize, utoipa::IntoParams)]
#[serde(rename_all = "camelCase")]
pub struct RandomLevelQuery {
    #[serde(default)]
    minimum_points: i32,
}

#[utoipa::path(get, path = "/discord-bot/levels/random", params(RandomLevelQuery), responses((status = 200), (status = 400), (status = 401), (status = 404)))]
pub async fn random_level(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<RandomLevelQuery>,
) -> ApiResult<Json<Value>> {
    authorize(&state, &headers)?;
    if query.minimum_points < 0 {
        return Err(invalid());
    }
    state
        .database
        .discord_random_level(query.minimum_points)
        .await
        .map_err(Problem::internal)?
        .map(Json)
        .ok_or_else(not_found)
}

#[derive(Deserialize, utoipa::IntoParams)]
pub struct StatisticsQuery {
    range: String,
    from: Option<String>,
    to: Option<String>,
}

#[utoipa::path(get, path = "/discord-bot/users/{discord_id}/statistics", params(("discord_id" = String, Path), StatisticsQuery), responses((status = 200), (status = 400), (status = 401), (status = 404)))]
pub async fn user_statistics(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(discord_id): Path<String>,
    Query(query): Query<StatisticsQuery>,
) -> ApiResult<Json<Value>> {
    authorize(&state, &headers)?;
    if !matches!(
        query.range.as_str(),
        "today"
            | "yesterday"
            | "this-week"
            | "last-week"
            | "this-month"
            | "last-month"
            | "this-year"
            | "last-year"
            | "all-time"
            | "custom"
    ) {
        return Err(invalid());
    }
    if query.range == "custom" {
        let (Some(from), Some(to)) = (&query.from, &query.to) else {
            return Err(invalid());
        };
        let from = from.parse::<jiff::civil::Date>().map_err(|_| invalid())?;
        let to = to.parse::<jiff::civil::Date>().map_err(|_| invalid())?;
        if from > to {
            return Err(invalid());
        }
    }
    state
        .database
        .discord_user_statistics(
            unsigned_bigint(&discord_id)?,
            &query.range,
            query.from.as_deref(),
            query.to.as_deref(),
        )
        .await
        .map_err(Problem::internal)?
        .map(Json)
        .ok_or_else(|| Problem {
            status: StatusCode::NOT_FOUND,
            detail: "Linked player not found".into(),
            error_code: None,
        })
}

#[derive(Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistBody {
    discord_id: String,
    count: i64,
    sort: String,
    #[serde(default)]
    without_wr: bool,
    #[serde(default)]
    without_pb: bool,
    #[serde(default)]
    no_records: bool,
}

#[utoipa::path(post, path = "/discord-bot/playlists", request_body = PlaylistBody, responses((status = 200), (status = 400), (status = 401)))]
pub async fn playlist(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<PlaylistBody>,
) -> ApiResult<Json<Vec<Value>>> {
    authorize(&state, &headers)?;
    if !(1..=100).contains(&body.count)
        || !matches!(
            body.sort.as_str(),
            "points" | "popularity" | "records" | "created" | "updated"
        )
    {
        return Err(invalid());
    }
    Ok(Json(
        state
            .database
            .discord_playlist_levels(
                unsigned_bigint(&body.discord_id)?,
                body.count,
                &body.sort,
                body.without_wr,
                body.without_pb,
                body.no_records,
            )
            .await
            .map_err(Problem::internal)?,
    ))
}

#[derive(Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RecommendedPlaylistBody {
    discord_id: String,
    count: i64,
}

#[utoipa::path(post, path = "/discord-bot/playlists/recommended", request_body = RecommendedPlaylistBody, responses((status = 200), (status = 400), (status = 401)))]
pub async fn recommended_playlist(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<RecommendedPlaylistBody>,
) -> ApiResult<Json<Vec<Value>>> {
    authorize(&state, &headers)?;
    if !(1..=50).contains(&body.count) {
        return Err(invalid());
    }
    Ok(Json(
        state
            .database
            .discord_recommended_levels(unsigned_bigint(&body.discord_id)?, body.count)
            .await
            .map_err(Problem::internal)?,
    ))
}

fn not_found() -> Problem {
    Problem {
        status: StatusCode::NOT_FOUND,
        detail: "Public level not found".into(),
        error_code: None,
    }
}

#[utoipa::path(get, path = "/discord-bot/activity-events", params(ActivityEventsQuery), responses((status = 200), (status = 400), (status = 401)))]
pub async fn activity_events(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ActivityEventsQuery>,
) -> ApiResult<Json<Vec<Value>>> {
    authorize(&state, &headers)?;
    if !(1..=500).contains(&query.limit) {
        return Err(invalid());
    }
    Ok(Json(
        state
            .database
            .discord_activity_events_after(unsigned_bigint(&query.after)?, query.limit)
            .await
            .map_err(Problem::internal)?,
    ))
}

#[utoipa::path(get, path = "/discord-bot/tournaments/current", responses((status = 200), (status = 401)))]
pub async fn current_tournaments(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> ApiResult<Json<Vec<Value>>> {
    authorize(&state, &headers)?;
    Ok(Json(
        state
            .database
            .discord_tournament_snapshots()
            .await
            .map_err(Problem::internal)?,
    ))
}

#[derive(Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct WatchTarget {
    kind: String,
    target_ids: Vec<String>,
}

#[derive(Deserialize, utoipa::ToSchema)]
pub struct WatchTargetsBody {
    targets: Vec<WatchTarget>,
}

#[utoipa::path(post, path = "/discord-bot/watches/matches", request_body = WatchTargetsBody, responses((status = 200), (status = 400), (status = 401)))]
pub async fn match_watches(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<WatchTargetsBody>,
) -> ApiResult<Json<Vec<Value>>> {
    authorize(&state, &headers)?;
    if body.targets.len() > 4
        || body.targets.iter().any(|target| {
            !watch_kind(&target.kind)
                || target.target_ids.len() > 50
                || target
                    .target_ids
                    .iter()
                    .any(|id| id.is_empty() || id.len() > 128)
        })
    {
        return Err(invalid());
    }
    let targets = body
        .targets
        .into_iter()
        .map(|target| (target.kind, target.target_ids))
        .collect::<Vec<_>>();
    Ok(Json(
        state
            .database
            .matching_discord_watches(&targets)
            .await
            .map_err(Problem::internal)?,
    ))
}

#[derive(Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct WatchDeliveryBody {
    paused: bool,
    last_error: Option<String>,
    delivery_key: Option<String>,
}

#[utoipa::path(patch, path = "/discord-bot/watches/{watch_id}/delivery", params(("watch_id" = String, Path)), request_body = WatchDeliveryBody, responses((status = 200), (status = 400), (status = 401)))]
pub async fn update_watch_delivery(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(watch_id): Path<String>,
    Json(body): Json<WatchDeliveryBody>,
) -> ApiResult<Json<Option<Value>>> {
    authorize(&state, &headers)?;
    if body
        .last_error
        .as_ref()
        .is_some_and(|value| value.len() > 1000)
        || body
            .delivery_key
            .as_ref()
            .is_some_and(|value| value.is_empty() || value.len() > 128)
    {
        return Err(invalid());
    }
    Ok(Json(
        state
            .database
            .update_discord_watch_delivery(
                positive(&watch_id)?,
                body.paused,
                body.last_error.as_deref(),
                body.delivery_key.as_deref(),
            )
            .await
            .map_err(Problem::internal)?,
    ))
}

#[utoipa::path(get, path = "/discord-bot/workers/{key}/cursor", params(("key" = String, Path)), responses((status = 200), (status = 400), (status = 401)))]
pub async fn get_worker_cursor(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(key): Path<String>,
) -> ApiResult<Json<Value>> {
    authorize(&state, &headers)?;
    validate_worker_key(&key)?;
    Ok(Json(
        state
            .database
            .discord_worker_cursor(&key)
            .await
            .map_err(Problem::internal)?,
    ))
}

#[derive(Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct EventBody {
    event_id: String,
}

#[utoipa::path(post, path = "/discord-bot/workers/{key}/cursor", params(("key" = String, Path)), request_body = EventBody, responses((status = 200), (status = 400), (status = 401)))]
pub async fn advance_worker_cursor(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(key): Path<String>,
    Json(body): Json<EventBody>,
) -> ApiResult<Json<Option<Value>>> {
    authorize(&state, &headers)?;
    validate_worker_key(&key)?;
    Ok(Json(
        state
            .database
            .advance_discord_worker_cursor(&key, unsigned_bigint(&body.event_id)?)
            .await
            .map_err(Problem::internal)?,
    ))
}

#[utoipa::path(get, path = "/discord-bot/guild-feeds/enabled", responses((status = 200), (status = 401)))]
pub async fn enabled_guild_feeds(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> ApiResult<Json<Vec<Value>>> {
    authorize(&state, &headers)?;
    Ok(Json(
        state
            .database
            .enabled_discord_guild_feeds()
            .await
            .map_err(Problem::internal)?,
    ))
}

#[utoipa::path(get, path = "/discord-bot/guilds/{guild_id}", params(("guild_id" = String, Path)), responses((status = 200), (status = 401)))]
pub async fn guild_state(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(guild_id): Path<String>,
) -> ApiResult<Json<Value>> {
    authorize(&state, &headers)?;
    Ok(Json(
        state
            .database
            .discord_guild_state(snowflake(&guild_id)?)
            .await
            .map_err(Problem::internal)?,
    ))
}

#[derive(Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LinkedRoleBody {
    role_id: Option<String>,
}

#[utoipa::path(put, path = "/discord-bot/guilds/{guild_id}/linked-role", params(("guild_id" = String, Path)), request_body = LinkedRoleBody, responses((status = 200), (status = 400), (status = 401)))]
pub async fn set_linked_role(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(guild_id): Path<String>,
    Json(body): Json<LinkedRoleBody>,
) -> ApiResult<Json<Value>> {
    authorize(&state, &headers)?;
    let role_id = body.role_id.as_deref().map(snowflake).transpose()?;
    Ok(Json(
        state
            .database
            .set_discord_guild_linked_role(snowflake(&guild_id)?, role_id)
            .await
            .map_err(Problem::internal)?,
    ))
}

#[derive(Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GuildFeedBody {
    channel_id: String,
    enabled: bool,
}

#[utoipa::path(put, path = "/discord-bot/guilds/{guild_id}/feeds/{kind}", params(("guild_id" = String, Path), ("kind" = String, Path)), request_body = GuildFeedBody, responses((status = 200), (status = 400), (status = 401)))]
pub async fn set_guild_feed(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((guild_id, kind)): Path<(String, String)>,
    Json(body): Json<GuildFeedBody>,
) -> ApiResult<Json<Value>> {
    authorize(&state, &headers)?;
    if !feed_kind(&kind) {
        return Err(invalid());
    }
    Ok(Json(
        state
            .database
            .set_discord_guild_feed(
                snowflake(&guild_id)?,
                &kind,
                snowflake(&body.channel_id)?,
                body.enabled,
            )
            .await
            .map_err(Problem::internal)?,
    ))
}

#[utoipa::path(post, path = "/discord-bot/guilds/{guild_id}/feeds/{kind}/cursor", params(("guild_id" = String, Path), ("kind" = String, Path)), request_body = EventBody, responses((status = 200), (status = 400), (status = 401)))]
pub async fn advance_guild_feed(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((guild_id, kind)): Path<(String, String)>,
    Json(body): Json<EventBody>,
) -> ApiResult<Json<Option<Value>>> {
    authorize(&state, &headers)?;
    if !feed_kind(&kind) {
        return Err(invalid());
    }
    Ok(Json(
        state
            .database
            .advance_discord_guild_feed_cursor(
                snowflake(&guild_id)?,
                &kind,
                unsigned_bigint(&body.event_id)?,
            )
            .await
            .map_err(Problem::internal)?,
    ))
}

#[derive(Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DigestBody {
    channel_id: String,
    daily_enabled: bool,
    weekly_enabled: bool,
    delivery_hour: i32,
    weekly_day: i32,
    next_delivery_at: Option<String>,
}

#[utoipa::path(put, path = "/discord-bot/guilds/{guild_id}/digest", params(("guild_id" = String, Path)), request_body = DigestBody, responses((status = 200), (status = 400), (status = 401)))]
pub async fn set_guild_digest(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(guild_id): Path<String>,
    Json(body): Json<DigestBody>,
) -> ApiResult<Json<Value>> {
    authorize(&state, &headers)?;
    if !(0..=23).contains(&body.delivery_hour)
        || !(0..=6).contains(&body.weekly_day)
        || body
            .next_delivery_at
            .as_deref()
            .is_some_and(|value| value.parse::<jiff::Timestamp>().is_err())
    {
        return Err(invalid());
    }
    Ok(Json(
        state
            .database
            .set_discord_digest(
                snowflake(&guild_id)?,
                snowflake(&body.channel_id)?,
                body.daily_enabled,
                body.weekly_enabled,
                body.delivery_hour,
                body.weekly_day,
                body.next_delivery_at.as_deref(),
            )
            .await
            .map_err(Problem::internal)?,
    ))
}

#[derive(Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryBody {
    channel_id: String,
    message_id: Option<String>,
    status: String,
    last_error: Option<String>,
}

#[utoipa::path(put, path = "/discord-bot/guilds/{guild_id}/deliveries/{source_event_id}", params(("guild_id" = String, Path), ("source_event_id" = String, Path)), request_body = DeliveryBody, responses((status = 200), (status = 400), (status = 401)))]
pub async fn set_delivery(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((guild_id, event_id)): Path<(String, String)>,
    Json(body): Json<DeliveryBody>,
) -> ApiResult<Json<Value>> {
    authorize(&state, &headers)?;
    if !matches!(body.status.as_str(), "pending" | "sent" | "failed")
        || body
            .last_error
            .as_ref()
            .is_some_and(|value| value.len() > 1000)
    {
        return Err(invalid());
    }
    let message_id = body.message_id.as_deref().map(snowflake).transpose()?;
    Ok(Json(
        state
            .database
            .set_discord_delivery(
                snowflake(&guild_id)?,
                unsigned_bigint(&event_id)?,
                snowflake(&body.channel_id)?,
                message_id,
                &body.status,
                body.last_error.as_deref(),
            )
            .await
            .map_err(Problem::internal)?,
    ))
}

#[utoipa::path(get, path = "/discord-bot/guilds/{guild_id}/deliveries/{source_event_id}", params(("guild_id" = String, Path), ("source_event_id" = String, Path)), responses((status = 200), (status = 400), (status = 401)))]
pub async fn get_delivery(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((guild_id, event_id)): Path<(String, String)>,
) -> ApiResult<Json<Option<Value>>> {
    authorize(&state, &headers)?;
    Ok(Json(
        state
            .database
            .discord_delivery(snowflake(&guild_id)?, unsigned_bigint(&event_id)?)
            .await
            .map_err(Problem::internal)?,
    ))
}

#[derive(Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TournamentMessageBody {
    channel_id: String,
    message_id: String,
    content_hash: String,
}

#[utoipa::path(put, path = "/discord-bot/guilds/{guild_id}/tournaments/{tournament_id}/message", params(("guild_id" = String, Path), ("tournament_id" = String, Path)), request_body = TournamentMessageBody, responses((status = 200), (status = 400), (status = 401)))]
pub async fn set_tournament_message(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((guild_id, tournament_id)): Path<(String, String)>,
    Json(body): Json<TournamentMessageBody>,
) -> ApiResult<Json<Value>> {
    authorize(&state, &headers)?;
    if !(16..=128).contains(&body.content_hash.len()) {
        return Err(invalid());
    }
    let tournament_id = tournament_id
        .parse::<i32>()
        .ok()
        .filter(|value| *value > 0)
        .ok_or_else(invalid)?;
    Ok(Json(
        state
            .database
            .set_discord_tournament_message(
                snowflake(&guild_id)?,
                tournament_id,
                snowflake(&body.channel_id)?,
                snowflake(&body.message_id)?,
                &body.content_hash,
            )
            .await
            .map_err(Problem::internal)?,
    ))
}

fn authorize(state: &AppState, headers: &HeaderMap) -> ApiResult<()> {
    auth::service_token(headers, &state.config.discord_bot_api_token).map_err(|_| Problem {
        status: StatusCode::UNAUTHORIZED,
        detail: "Not authenticated".to_owned(),
        error_code: Some("invalid_bot_token".into()),
    })
}

fn invalid() -> Problem {
    Problem {
        status: StatusCode::BAD_REQUEST,
        detail: "Invalid request".to_owned(),
        error_code: Some("invalid".into()),
    }
}

fn snowflake(value: &str) -> ApiResult<i64> {
    if value.is_empty() || value.len() > 20 || !value.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err(invalid());
    }
    value.parse().map_err(|_| invalid())
}

fn unsigned_bigint(value: &str) -> ApiResult<i64> {
    if value.is_empty() || value.len() > 30 || !value.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err(invalid());
    }
    value.parse().map_err(|_| invalid())
}

fn positive(value: &str) -> ApiResult<i64> {
    unsigned_bigint(value).and_then(|value| (value > 0).then_some(value).ok_or_else(invalid))
}

fn watch_kind(value: &str) -> bool {
    matches!(value, "player" | "level" | "author" | "tournament")
}

fn feed_kind(value: &str) -> bool {
    matches!(
        value,
        "workshop" | "world_record" | "rank" | "totw" | "totm"
    )
}

fn validate_worker_key(value: &str) -> ApiResult<()> {
    if value.is_empty()
        || value.len() > 32
        || !value.as_bytes()[0].is_ascii_lowercase()
        || !value.bytes().all(|byte| {
            byte.is_ascii_lowercase() || byte.is_ascii_digit() || matches!(byte, b'_' | b'-')
        })
    {
        return Err(invalid());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_discord_runtime_identifiers() {
        assert!(watch_kind("tournament"));
        assert!(!watch_kind("other"));
        assert!(feed_kind("world_record"));
        assert!(!feed_kind("personal_best"));
        assert!(validate_worker_key("activity-watches").is_ok());
        assert!(validate_worker_key("Activity").is_err());
        assert_eq!(unsigned_bigint("0").unwrap(), 0);
        assert!(positive("0").is_err());
    }
}
