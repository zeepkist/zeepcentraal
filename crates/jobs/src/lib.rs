use serde::{Deserialize, Serialize};

pub mod cron;
pub mod handlers;
pub mod queue;
pub mod retry;
pub mod runtime;

pub const FAST_CONCURRENCY: usize = 4;
pub const BULK_CONCURRENCY: usize = 14;
pub const VISIBILITY_SECONDS: i32 = 120;
pub const HEARTBEAT_SECONDS: u64 = 30;
pub const POLL_MILLISECONDS: u64 = 250;

#[derive(Clone, Copy, Debug, Deserialize, Eq, Hash, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum TaskIdentifier {
    BackfillRecordGhostStatistics,
    BackfillRecordGhostStatisticsBatch,
    PrunePointsHistory,
    RecoverLevelRequests,
    PrepareTrackTournamentLobbyAsset,
    ScanWorkshopBatch,
    ScanWorkshopItem,
    RotateTrackTournament,
    SyncPersonalBests,
    SyncWorkshopCatalog,
    UpdateLevelPointsHistory,
    UpdateLevelPointsHistoryBatch,
    UpdateLevelContributions,
    UpdateLevelScore,
    UpdateLevelScores,
    UpdatePlayerScore,
    UpdatePlayerScores,
    UpdateUserPointsHistory,
    UpdateUserPointsHistoryBatch,
}

impl TaskIdentifier {
    pub const ALL: [Self; 19] = [
        Self::BackfillRecordGhostStatistics,
        Self::BackfillRecordGhostStatisticsBatch,
        Self::PrunePointsHistory,
        Self::RecoverLevelRequests,
        Self::PrepareTrackTournamentLobbyAsset,
        Self::ScanWorkshopBatch,
        Self::ScanWorkshopItem,
        Self::RotateTrackTournament,
        Self::SyncPersonalBests,
        Self::SyncWorkshopCatalog,
        Self::UpdateLevelPointsHistory,
        Self::UpdateLevelPointsHistoryBatch,
        Self::UpdateLevelContributions,
        Self::UpdateLevelScore,
        Self::UpdateLevelScores,
        Self::UpdatePlayerScore,
        Self::UpdatePlayerScores,
        Self::UpdateUserPointsHistory,
        Self::UpdateUserPointsHistoryBatch,
    ];

    pub const fn as_str(self) -> &'static str {
        match self {
            Self::BackfillRecordGhostStatistics => "backfillRecordGhostStatistics",
            Self::BackfillRecordGhostStatisticsBatch => "backfillRecordGhostStatisticsBatch",
            Self::PrunePointsHistory => "prunePointsHistory",
            Self::RecoverLevelRequests => "recoverLevelRequests",
            Self::PrepareTrackTournamentLobbyAsset => "prepareTrackTournamentLobbyAsset",
            Self::ScanWorkshopBatch => "scanWorkshopBatch",
            Self::ScanWorkshopItem => "scanWorkshopItem",
            Self::RotateTrackTournament => "rotateTrackTournament",
            Self::SyncPersonalBests => "syncPersonalBests",
            Self::SyncWorkshopCatalog => "syncWorkshopCatalog",
            Self::UpdateLevelPointsHistory => "updateLevelPointsHistory",
            Self::UpdateLevelPointsHistoryBatch => "updateLevelPointsHistoryBatch",
            Self::UpdateLevelContributions => "updateLevelContributions",
            Self::UpdateLevelScore => "updateLevelScore",
            Self::UpdateLevelScores => "updateLevelScores",
            Self::UpdatePlayerScore => "updatePlayerScore",
            Self::UpdatePlayerScores => "updatePlayerScores",
            Self::UpdateUserPointsHistory => "updateUserPointsHistory",
            Self::UpdateUserPointsHistoryBatch => "updateUserPointsHistoryBatch",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|task| task.as_str() == value)
    }

    pub const fn compatible(self) -> bool {
        !matches!(
            self,
            Self::RecoverLevelRequests
                | Self::RotateTrackTournament
                | Self::UpdateLevelContributions
        )
    }

    pub const fn max_attempts(self) -> i32 {
        match self {
            Self::BackfillRecordGhostStatistics | Self::BackfillRecordGhostStatisticsBatch => 1,
            Self::PrepareTrackTournamentLobbyAsset
            | Self::ScanWorkshopBatch
            | Self::ScanWorkshopItem => 5,
            _ => 3,
        }
    }

    pub fn validate_payload(self, payload: &serde_json::Value) -> bool {
        let Some(object) = payload.as_object() else {
            return false;
        };
        let positive_i64 = |name: &str| {
            object
                .get(name)
                .and_then(serde_json::Value::as_i64)
                .is_some_and(|value| value > 0)
        };
        let positive_ids = |name: &str, maximum: usize| {
            object
                .get(name)
                .and_then(serde_json::Value::as_array)
                .is_some_and(|values| {
                    !values.is_empty()
                        && values.len() <= maximum
                        && values
                            .iter()
                            .all(|value| value.as_i64().is_some_and(|value| value > 0))
                })
        };
        let optional_bool = |name: &str| object.get(name).is_none_or(serde_json::Value::is_boolean);
        let optional_defer = || {
            object
                .get("deferCount")
                .is_none_or(|value| value.as_u64().is_some_and(|count| count <= 4))
        };
        match self {
            Self::ScanWorkshopItem => object
                .get("workshopId")
                .and_then(serde_json::Value::as_str)
                .is_some_and(valid_positive_decimal),
            Self::ScanWorkshopBatch => {
                object
                    .get("workshopIds")
                    .and_then(serde_json::Value::as_array)
                    .is_some_and(|values| {
                        !values.is_empty()
                            && values.len() <= 10
                            && values
                                .iter()
                                .all(|value| value.as_str().is_some_and(valid_positive_decimal))
                    })
                    && optional_bool("fixZeepSDKExponentHashes")
            }
            Self::PrepareTrackTournamentLobbyAsset => positive_i64("idTournament"),
            Self::UpdateLevelScore => {
                positive_i64("idLevel")
                    && object.get("idUser").is_none_or(|_| positive_i64("idUser"))
                    && optional_bool("reportOnly")
                    && optional_defer()
            }
            Self::UpdateLevelContributions => {
                let token = object
                    .get("projectionToken")
                    .and_then(serde_json::Value::as_str)
                    .is_some_and(|value| !value.is_empty() && value.len() <= 128);
                let cursor = (object.len() == 2 || object.len() == 3 || object.len() == 4)
                    && positive_i64("idLevel")
                    && object
                        .get("afterUserId")
                        .and_then(serde_json::Value::as_i64)
                        .is_some_and(|value| value >= 0)
                    && object
                        .get("deferCount")
                        .is_none_or(|value| value.as_u64().is_some_and(|count| count <= 4))
                    && (object.len() == 2 || token || object.contains_key("deferCount"))
                    && object.keys().all(|key| {
                        matches!(
                            key.as_str(),
                            "idLevel" | "afterUserId" | "projectionToken" | "deferCount"
                        )
                    });
                let repair = object.len() == 4
                    && positive_i64("idLevel")
                    && positive_i64("idUser")
                    && object
                        .get("deferCount")
                        .and_then(serde_json::Value::as_u64)
                        .is_some_and(|value| value <= 1_000_000)
                    && token;
                cursor || repair
            }
            Self::UpdateLevelScores => optional_bool("all") && optional_bool("reportOnly"),
            Self::UpdatePlayerScore => positive_i64("idUser") && optional_defer(),
            Self::RotateTrackTournament => object
                .get("type")
                .and_then(serde_json::Value::as_i64)
                .is_some_and(|value| matches!(value, 0 | 1)),
            Self::BackfillRecordGhostStatisticsBatch => positive_ids("ids", 500),
            Self::UpdateLevelPointsHistoryBatch | Self::UpdateUserPointsHistoryBatch => {
                positive_ids("ids", usize::MAX)
                    || (object
                        .get("offset")
                        .and_then(serde_json::Value::as_i64)
                        .is_some_and(|value| value >= 0)
                        && positive_i64("limit"))
            }
            Self::BackfillRecordGhostStatistics => {
                object
                    .get("ids")
                    .is_none_or(|_| positive_ids("ids", usize::MAX))
                    && object.get("limit").is_none_or(|value| {
                        value
                            .as_i64()
                            .is_some_and(|value| (1..=500).contains(&value))
                    })
                    && object
                        .get("reparseGhostVersion")
                        .is_none_or(|value| value.as_i64() == Some(5))
                    && !(object.contains_key("ids") && object.contains_key("reparseGhostVersion"))
            }
            Self::SyncWorkshopCatalog => {
                optional_bool("all")
                    && optional_bool("fixZeepSDKExponentHashes")
                    && object
                        .get("repairZslAuthors")
                        .is_none_or(|value| value.as_bool() == Some(true))
                    && !(object
                        .get("repairZslAuthors")
                        .and_then(serde_json::Value::as_bool)
                        == Some(true)
                        && (object.get("all").and_then(serde_json::Value::as_bool) == Some(true)
                            || object
                                .get("fixZeepSDKExponentHashes")
                                .and_then(serde_json::Value::as_bool)
                                == Some(true)))
            }
            _ => true,
        }
    }
}

fn valid_positive_decimal(value: &str) -> bool {
    !value.is_empty() && !value.starts_with('0') && value.bytes().all(|byte| byte.is_ascii_digit())
}

#[cfg(test)]
mod tests {
    use super::TaskIdentifier;

    #[test]
    fn task_registry_matches_bun_count() {
        assert_eq!(super::TaskIdentifier::ALL.len(), 19);
        for task in super::TaskIdentifier::ALL {
            assert_eq!(super::TaskIdentifier::parse(task.as_str()), Some(task));
        }
    }

    #[test]
    fn payload_validation_matches_allowlist_contract() {
        use serde_json::json;
        assert!(TaskIdentifier::UpdateLevelScores.validate_payload(&json!({"all": true})));
        assert!(!TaskIdentifier::UpdateLevelScores.validate_payload(&json!({"all": 1})));
        assert!(TaskIdentifier::UpdateLevelContributions.validate_payload(
            &json!({"idLevel": 1, "afterUserId": 0, "projectionToken": "token"})
        ));
        assert!(
            TaskIdentifier::UpdateLevelContributions
                .validate_payload(&json!({"idLevel": 1, "afterUserId": 0}))
        );
        assert!(
            TaskIdentifier::UpdateLevelContributions
                .validate_payload(&json!({"idLevel": 1, "afterUserId": 50, "deferCount": 2}))
        );
        assert!(
            !TaskIdentifier::UpdateLevelContributions
                .validate_payload(&json!({"idLevel": 1, "afterUserId": 50, "deferCount": 5}))
        );
        assert!(TaskIdentifier::UpdateLevelContributions.validate_payload(
            &json!({"idLevel": 1, "idUser": 2, "projectionToken": "token", "deferCount": 0})
        ));
        assert!(!TaskIdentifier::UpdateLevelContributions.validate_payload(
            &json!({"idLevel": 1, "afterUserId": 0, "idUser": 2, "projectionToken": "token", "deferCount": 0})
        ));
        assert!(!TaskIdentifier::UpdateLevelContributions.compatible());
        assert!(
            TaskIdentifier::SyncWorkshopCatalog
                .validate_payload(&json!({"repairZslAuthors": true}))
        );
        assert!(
            !TaskIdentifier::SyncWorkshopCatalog
                .validate_payload(&json!({"repairZslAuthors": true, "all": true}))
        );
        assert!(
            !TaskIdentifier::ScanWorkshopBatch.validate_payload(
                &json!({"workshopIds": ["1"], "fixZeepSDKExponentHashes": "yes"})
            )
        );
    }
}
