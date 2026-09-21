use crate::{
    model::{SeasonMetadata, SeasonStanding, SuperLeagueMetadata, TournamentEvent},
    rank_by_points,
    uid::database_level_uid,
};
use anyhow::{Context, Result};
use std::{collections::HashMap, path::Path};
use zc_database::services::zsl::{RankedLevelResult, RankedResult};

pub async fn run() -> Result<()> {
    let root = zc_core::environment::var("SUPER_LEAGUE_DATA_PATH")
        .unwrap_or_else(|_| "super_league_data".to_owned());
    let database_config = zc_core::DatabaseConfig::from_env_with_profile(
        1,
        zc_core::config::DatabaseProfile::Worker,
    )?;
    let pool = zc_database::DatabasePool::connect(
        &database_config.url,
        zc_database::PoolSettings::from_database_config(
            &database_config,
            "zeepcentraal-import-zsl",
        ),
        zc_database::PoolBudget::application(database_config.pool_max),
    )
    .await?;
    let database = zc_database::Database::from_partition(pool.application());
    let steam = zc_core::steam::SteamClient::new(
        zc_core::config::required("STEAM_API_KEY")?,
        zc_core::environment::var("STEAM_APP_ID")
            .unwrap_or_else(|_| "1440670".to_owned())
            .parse()
            .context("STEAM_APP_ID must be a positive integer")?,
    )?;
    import_all(Path::new(&root), &database, &steam).await
}

async fn import_all(
    root: &Path,
    database: &zc_database::Database,
    steam: &zc_core::steam::SteamClient,
) -> Result<()> {
    let metadata: SuperLeagueMetadata = read_json(&root.join("metadata.json")).await?;
    tracing::info!(seasons = metadata.len(), path = %root.display(), "Loaded Super League metadata");
    let mut previous_points_structure = 1;
    for (season_name, metadata) in metadata {
        let event_dates: Vec<String> = metadata
            .events
            .iter()
            .map(|(date, _)| date.clone())
            .collect();
        if event_dates.is_empty() {
            tracing::warn!(season = season_name, "Season has no events");
            continue;
        }
        let (season_id, user_ids, points_structure) = import_season(
            root,
            database,
            steam,
            &season_name,
            &metadata,
            &event_dates,
            previous_points_structure,
        )
        .await?;
        previous_points_structure = points_structure;
        for (index, (event_date, event)) in metadata.events.into_iter().enumerate() {
            import_round(
                root,
                database,
                &season_name,
                season_id,
                i32::try_from(index + 1)?,
                &event_date,
                &event.name,
                parse_workshop_id(&event.workshop_id),
                &user_ids,
            )
            .await?;
        }
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)]
async fn import_season(
    root: &Path,
    database: &zc_database::Database,
    steam: &zc_core::steam::SteamClient,
    season_name: &str,
    _metadata: &SeasonMetadata,
    event_dates: &[String],
    points_structure: i32,
) -> Result<(i32, HashMap<String, i32>, i32)> {
    let season = database
        .get_or_create_zsl_season(
            season_name,
            points_structure,
            &event_dates[0],
            event_dates.last().expect("non-empty event dates"),
        )
        .await?;
    let standings: Vec<SeasonStanding> =
        read_json(&root.join(season_name).join("standings.json")).await?;
    if standings.is_empty() {
        tracing::warn!(season = season_name, "Season has no standings");
        return Ok((season.id, HashMap::new(), season.id_points_structure));
    }
    let user_ids =
        resolve_users(database, steam, standings.iter().map(|row| &row.steam_id)).await?;
    let results = rank_by_points(
        standings
            .into_iter()
            .map(|row| (row.steam_id, row.total_points)),
    )
    .into_iter()
    .filter_map(|row| {
        user_ids.get(&row.value).map(|id_user| RankedResult {
            id_parent: season.id,
            id_user: *id_user,
            points: row.points,
            position: row.position,
        })
    })
    .collect::<Vec<_>>();
    database.upsert_zsl_season_results(&results).await?;
    tracing::info!(
        season = season_name,
        users = user_ids.len(),
        "Imported ZSL season"
    );
    Ok((season.id, user_ids, season.id_points_structure))
}

#[allow(clippy::too_many_arguments)]
async fn import_round(
    root: &Path,
    database: &zc_database::Database,
    season_name: &str,
    id_season: i32,
    round_number: i32,
    event_date: &str,
    name: &str,
    workshop_id: i64,
    user_ids: &HashMap<String, i32>,
) -> Result<()> {
    let round = database
        .get_or_create_zsl_round(id_season, round_number, name, workshop_id, event_date)
        .await?;
    if database.zsl_event_is_future(event_date).await? {
        tracing::warn!(round = name, "Round is in the future");
        return Ok(());
    }
    let event: TournamentEvent =
        read_json(&root.join(season_name).join(format!("{event_date}.json"))).await?;
    if event.users.is_empty() || event.levels.is_empty() {
        tracing::warn!(round = name, "Round has no users or levels");
        return Ok(());
    }
    let round_results = rank_by_points(
        event
            .users
            .into_iter()
            .map(|row| (row.steam_id, row.total_points)),
    )
    .into_iter()
    .filter_map(|row| {
        user_ids.get(&row.value).map(|id_user| RankedResult {
            id_parent: round.id,
            id_user: *id_user,
            points: row.points,
            position: row.position,
        })
    })
    .collect::<Vec<_>>();
    database.upsert_zsl_round_results(&round_results).await?;

    let mapped_uids: Vec<String> = event
        .levels
        .iter()
        .map(|level| database_level_uid(&level.level).to_owned())
        .collect();
    let level_ids = database.levels_by_file_uids(&mapped_uids).await?;
    for level in event.levels {
        let file_uid = database_level_uid(&level.level);
        let Some(id_level) = level_ids.get(file_uid) else {
            tracing::warn!(
                uid = level.level,
                mapped_uid = file_uid,
                "ZSL level not found"
            );
            continue;
        };
        let zsl_level = database
            .get_or_create_zsl_level(round.id, *id_level)
            .await?;
        let level_results = rank_by_points(
            level
                .standings
                .into_iter()
                .filter_map(|row| row.time.map(|time| ((row.steam_id, time), row.points))),
        )
        .into_iter()
        .filter_map(|row| {
            user_ids.get(&row.value.0).map(|id_user| RankedLevelResult {
                id_level: zsl_level.id,
                id_user: *id_user,
                points: row.points,
                position: row.position,
                time: row.value.1,
            })
        })
        .collect::<Vec<_>>();
        database.upsert_zsl_level_results(&level_results).await?;
    }
    tracing::info!(round = name, "Imported ZSL round");
    Ok(())
}

async fn resolve_users<'a>(
    database: &zc_database::Database,
    steam: &zc_core::steam::SteamClient,
    steam_ids: impl Iterator<Item = &'a String>,
) -> Result<HashMap<String, i32>> {
    let mut unique = steam_ids
        .map(|value| value.parse::<i64>().map(|parsed| (value.clone(), parsed)))
        .collect::<std::result::Result<Vec<_>, _>>()?;
    unique.sort_by_key(|(_, parsed)| *parsed);
    unique.dedup_by_key(|(_, parsed)| *parsed);
    let numeric: Vec<i64> = unique.iter().map(|(_, parsed)| *parsed).collect();
    let existing = database.existing_zsl_users(&numeric).await?;
    let existing_names: HashMap<i64, Option<String>> = existing
        .into_iter()
        .map(|user| (user.steam_id, user.steam_name))
        .collect();
    let mut users = Vec::with_capacity(unique.len());
    for (text, steam_id) in &unique {
        let known = existing_names
            .get(steam_id)
            .and_then(|value| value.as_deref())
            .filter(|value| !value.is_empty() && *value != "Unknown");
        let name = if let Some(known) = known {
            known.to_owned()
        } else {
            steam
                .user(text)
                .await
                .map(|user| user.personaname)
                .unwrap_or_else(|_| "Unknown".to_owned())
        };
        users.push((*steam_id, name));
    }
    let resolved = database.upsert_zsl_users(&users).await?;
    Ok(unique
        .into_iter()
        .filter_map(|(text, numeric)| resolved.get(&numeric).map(|id| (text, *id)))
        .collect())
}

fn parse_workshop_id(value: &str) -> i64 {
    if !value.is_empty() && value.bytes().all(|byte| byte.is_ascii_digit()) {
        value.parse().unwrap_or(0)
    } else {
        0
    }
}

async fn read_json<T: serde::de::DeserializeOwned>(path: &Path) -> Result<T> {
    let contents = tokio::fs::read_to_string(path)
        .await
        .with_context(|| format!("Failed to read {}", path.display()))?;
    serde_json::from_str(&contents).with_context(|| format!("Invalid JSON in {}", path.display()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn workshop_ids_match_bigint_fallback_contract() {
        assert_eq!(parse_workshop_id("3507841441"), 3_507_841_441);
        assert_eq!(parse_workshop_id(""), 0);
        assert_eq!(parse_workshop_id("invalid"), 0);
    }
}
