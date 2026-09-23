use crate::Database;
use anyhow::{Result, ensure};
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{Array, BigInt, Bool, Float, Integer, Nullable, Text},
};
use diesel_async::RunQueryDsl;

#[derive(Clone, Debug, QueryableByName)]
pub struct TournamentLobbyAsset {
    #[diesel(sql_type = Integer)]
    pub id_tournament: i32,
    #[diesel(sql_type = BigInt)]
    pub workshop_id: i64,
    #[diesel(sql_type = Text)]
    pub file_uid: String,
    #[diesel(sql_type = Text)]
    pub level_name: String,
    #[diesel(sql_type = Text)]
    pub author: String,
    #[diesel(sql_type = Text)]
    pub collaborators: String,
    #[diesel(sql_type = Text)]
    pub override_author_name: String,
    #[diesel(sql_type = Text)]
    pub object_key: String,
    #[diesel(sql_type = Text)]
    pub content_sha256: String,
    #[diesel(sql_type = Integer)]
    pub byte_size: i32,
    #[diesel(sql_type = Text)]
    pub tournament_slug: String,
    #[diesel(sql_type = Text)]
    pub tournament_end_at: String,
}

#[derive(Clone, Debug, QueryableByName)]
pub struct TournamentLobbyStanding {
    #[diesel(sql_type = Integer)]
    pub user_id: i32,
    #[diesel(sql_type = Integer)]
    pub record_id: i32,
    #[diesel(sql_type = BigInt)]
    pub steam_id: i64,
    #[diesel(sql_type = Nullable<Text>)]
    pub steam_name: Option<String>,
    #[diesel(sql_type = Float)]
    pub time: f32,
    #[diesel(sql_type = Integer)]
    pub rank: i32,
    #[diesel(sql_type = Integer)]
    pub points: i32,
}

#[derive(Clone, Debug)]
pub struct TournamentLobbySnapshot {
    pub entries: i64,
    pub standings: Vec<TournamentLobbyStanding>,
    pub connected_players: Vec<TournamentLobbyStanding>,
}

#[derive(Clone, Debug)]
pub struct TournamentLobbyPlayerContext {
    pub minimum_gtr_version: Option<String>,
    pub user_exists: bool,
    pub recent_record: bool,
    pub standing: Option<(i32, f32)>,
}

#[derive(QueryableByName)]
struct PlayerContextRow {
    #[diesel(sql_type = Nullable<Text>)]
    minimum_gtr_version: Option<String>,
    #[diesel(sql_type = Nullable<Integer>)]
    user_id: Option<i32>,
    #[diesel(sql_type = Bool)]
    recent_record: bool,
    #[diesel(sql_type = Nullable<Integer>)]
    rank: Option<i32>,
    #[diesel(sql_type = Nullable<Float>)]
    time: Option<f32>,
}

#[derive(QueryableByName)]
struct CountRow {
    #[diesel(sql_type = BigInt)]
    count: i64,
}

impl Database {
    pub async fn tournament_lobby_player_context(
        &self,
        tournament_id: i32,
        steam_id: u64,
    ) -> Result<TournamentLobbyPlayerContext> {
        ensure!(tournament_id > 0, "Invalid tournament ID");
        let steam_id = i64::try_from(steam_id)?;
        let mut connection = self.connection().await?;
        let row = sql_query(
            "SELECT (SELECT minimum FROM public.version ORDER BY id DESC LIMIT 1) AS minimum_gtr_version, \
             account.id AS user_id, \
             COALESCE(EXISTS(SELECT 1 FROM public.record record \
                 WHERE record.id_user=account.id AND record.date_created>=clock_timestamp()-interval '720 hours'),false) AS recent_record, \
             result.rank,result.time \
             FROM (SELECT 1) seed \
             LEFT JOIN public.\"user\" account ON account.steam_id=$2 \
             LEFT JOIN public.track_tournament_result result \
                 ON result.id_user=account.id AND result.id_tournament=$1",
        )
        .bind::<Integer, _>(tournament_id)
        .bind::<BigInt, _>(steam_id)
        .get_result::<PlayerContextRow>(&mut connection)
        .await?;
        Ok(TournamentLobbyPlayerContext {
            minimum_gtr_version: row.minimum_gtr_version,
            user_exists: row.user_id.is_some(),
            recent_record: row.recent_record,
            standing: row
                .rank
                .zip(row.time)
                .filter(|(rank, time)| *rank > 0 && time.is_finite() && *time >= 0.0),
        })
    }

    pub async fn preferred_tournament_lobby_asset(
        &self,
        tournament_type: i32,
    ) -> Result<Option<TournamentLobbyAsset>> {
        ensure!(matches!(tournament_type, 0 | 1), "Invalid tournament type");
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "SELECT asset.id_tournament,asset.workshop_id,asset.file_uid,asset.level_name, \
             asset.author,asset.collaborators,asset.override_author_name,asset.object_key, \
             asset.content_sha256,asset.byte_size,tournament.slug AS tournament_slug, \
             to_char(tournament.end_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS tournament_end_at \
             FROM zc_private.track_tournament_lobby_asset asset \
             JOIN public.track_tournament tournament ON tournament.id=asset.id_tournament \
             WHERE tournament.type=$1 AND tournament.start_at<=clock_timestamp() \
             ORDER BY (tournament.end_at>clock_timestamp()) DESC,tournament.start_at DESC LIMIT 1",
        )
        .bind::<Integer, _>(tournament_type)
        .get_result(&mut connection)
        .await
            .optional()?)
    }

    pub async fn tournament_lobby_snapshot(
        &self,
        tournament_id: i32,
        steam_ids: &[u64],
    ) -> Result<TournamentLobbySnapshot> {
        ensure!(tournament_id > 0, "Invalid tournament ID");
        ensure!(
            steam_ids.len() <= 64,
            "Tournament roster exceeds 64 players"
        );
        let steam_ids = steam_ids
            .iter()
            .copied()
            .map(i64::try_from)
            .collect::<std::result::Result<Vec<_>, _>>()?;
        let mut connection = self.connection().await?;
        let entries = sql_query(
            "SELECT count(*)::bigint AS count FROM public.track_tournament_result \
             WHERE id_tournament=$1",
        )
        .bind::<Integer, _>(tournament_id)
        .get_result::<CountRow>(&mut connection)
        .await?
        .count;
        let standings = sql_query(
            "SELECT result.id_user AS user_id,result.id_record AS record_id,\"user\".steam_id, \
             \"user\".steam_name,result.time,result.rank,result.points \
             FROM public.track_tournament_result result \
             JOIN public.\"user\" ON \"user\".id=result.id_user \
             WHERE result.id_tournament=$1 AND \"user\".steam_id IS NOT NULL \
             ORDER BY result.rank,result.time,result.id_record LIMIT 6",
        )
        .bind::<Integer, _>(tournament_id)
        .load::<TournamentLobbyStanding>(&mut connection)
        .await?;
        let connected_players = if steam_ids.is_empty() {
            Vec::new()
        } else {
            sql_query(
                "SELECT result.id_user AS user_id,result.id_record AS record_id,\"user\".steam_id, \
                 \"user\".steam_name,result.time,result.rank,result.points \
                 FROM public.track_tournament_result result \
                 JOIN public.\"user\" ON \"user\".id=result.id_user \
                 WHERE result.id_tournament=$1 AND \"user\".steam_id=ANY($2) \
                 ORDER BY result.rank,result.time,result.id_record LIMIT 64",
            )
            .bind::<Integer, _>(tournament_id)
            .bind::<Array<BigInt>, _>(steam_ids)
            .load::<TournamentLobbyStanding>(&mut connection)
            .await?
        };
        Ok(TournamentLobbySnapshot {
            entries,
            standings,
            connected_players,
        })
    }
}
