use serde::{Deserialize, Serialize};

mod catalog;
pub mod cron;
pub mod ghost_audit;
pub mod handlers;
mod practice;
pub mod queue;
pub mod retry;
pub mod runtime;
mod zsl_warmup;

pub const FAST_CONCURRENCY: usize = 15;
pub const BULK_CONCURRENCY: usize = 15;
pub const VISIBILITY_SECONDS: i32 = 120;
pub const HEARTBEAT_SECONDS: u64 = 30;
pub const POLL_MILLISECONDS: u64 = 250;
pub const WORKSHOP_SCAN_BATCH_SIZE: usize = 10;

#[derive(Clone, Copy, Debug, Deserialize, Eq, Hash, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum TaskIdentifier {
    ValidateRecordGhost,
    AuditRecordGhosts,
    BackfillLevelSimhash,
    BackfillRecordGhostStatistics,
    BackfillRecordGhostStatisticsBatch,
    PrunePointsHistory,
    RecoverLevelRequests,
    PrepareTrackTournamentLobbyAsset,
    PrepareZslPracticePlaylist,
    PrepareZslWarmupPlaylist,
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
    pub const ALL: [Self; 24] = [
        Self::ValidateRecordGhost,
        Self::AuditRecordGhosts,
        Self::BackfillLevelSimhash,
        Self::BackfillRecordGhostStatistics,
        Self::BackfillRecordGhostStatisticsBatch,
        Self::PrunePointsHistory,
        Self::RecoverLevelRequests,
        Self::PrepareTrackTournamentLobbyAsset,
        Self::PrepareZslPracticePlaylist,
        Self::PrepareZslWarmupPlaylist,
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
            Self::ValidateRecordGhost => "validateRecordGhost",
            Self::AuditRecordGhosts => "auditRecordGhosts",
            Self::BackfillLevelSimhash => "backfillLevelSimhash",
            Self::BackfillRecordGhostStatistics => "backfillRecordGhostStatistics",
            Self::BackfillRecordGhostStatisticsBatch => "backfillRecordGhostStatisticsBatch",
            Self::PrunePointsHistory => "prunePointsHistory",
            Self::RecoverLevelRequests => "recoverLevelRequests",
            Self::PrepareTrackTournamentLobbyAsset => "prepareTrackTournamentLobbyAsset",
            Self::PrepareZslPracticePlaylist => "prepareZslPracticePlaylist",
            Self::PrepareZslWarmupPlaylist => "prepareZslWarmupPlaylist",
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
            | Self::PrepareZslPracticePlaylist
            | Self::PrepareZslWarmupPlaylist
            | Self::ScanWorkshopBatch
            | Self::ScanWorkshopItem => 5,
            _ => 3,
        }
    }

    pub fn validate_external_payload(self, payload: &serde_json::Value) -> bool {
        if self == Self::AuditRecordGhosts
            && payload.as_object().is_some_and(|object| {
                object.keys().any(|key| {
                    matches!(
                        key.as_str(),
                        "afterLevelId"
                            | "afterLevelRecordId"
                            | "idLevels"
                            | "work"
                            | "auditRunId"
                            | "deferCount"
                    )
                })
            })
        {
            return false;
        }
        self.validate_payload(payload)
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
            Self::BackfillLevelSimhash => object.is_empty(),
            Self::ValidateRecordGhost => {
                object.len() == 1
                    && positive_i64("idRecord")
                    && object["idRecord"]
                        .as_i64()
                        .is_some_and(|id| id <= i32::MAX.into())
            }
            Self::AuditRecordGhosts => {
                object.keys().all(|key| {
                    matches!(
                        key.as_str(),
                        "afterId"
                            | "throughId"
                            | "idRecord"
                            | "idLevel"
                            | "workshopId"
                            | "from"
                            | "to"
                            | "reasons"
                            | "afterLevelId"
                            | "afterLevelRecordId"
                            | "idLevels"
                            | "work"
                            | "auditRunId"
                            | "deferCount"
                    )
                }) && ["afterLevelId", "afterLevelRecordId"].iter().all(|key| {
                    object
                        .get(*key)
                        .is_none_or(|v| v.as_i64().is_some_and(|n| n >= 0 && n <= i32::MAX.into()))
                }) && object.get("auditRunId").is_none_or(|v| {
                    v.as_str()
                        .is_some_and(|s| s.parse::<u64>().is_ok_and(|n| n > 0))
                }) && object
                    .get("deferCount")
                    .is_none_or(|v| v.as_u64().is_some_and(|n| n <= 4))
                    && object
                        .get("idLevels")
                        .is_none_or(|v| valid_audit_ids(v, false))
                    && object.get("work").is_none_or(|v| {
                        v.as_object().is_some_and(|w| {
                            w.len() == 2
                                && w.get("recordIds")
                                    .is_some_and(|ids| valid_audit_ids(ids, true))
                                && w.get("next").is_some_and(|next| {
                                    next.is_null()
                                        || (next.get("work").is_none()
                                            && Self::AuditRecordGhosts.validate_payload(next))
                                })
                        })
                    })
                    && ["idRecord", "idLevel"].iter().all(|key| {
                        object.get(*key).is_none_or(|v| {
                            v.as_i64().is_some_and(|id| id > 0 && id <= i32::MAX.into())
                        })
                    })
                    && object.get("throughId").is_none_or(|v| {
                        v.as_i64()
                            .is_some_and(|id| id >= 0 && id <= i32::MAX.into())
                    })
                    && object.get("afterId").is_none_or(|v| {
                        v.as_i64()
                            .is_some_and(|id| id >= 0 && id <= i32::MAX.into())
                    })
                    && object.get("workshopId").is_none_or(|v| {
                        v.as_str()
                            .is_some_and(|s| s.parse::<i64>().is_ok_and(|id| id > 0))
                    })
                    && object.get("reasons").is_none_or(|value| {
                        value.as_array().is_some_and(|reasons| {
                            !reasons.is_empty()
                                && reasons.len() <= 2
                                && reasons.iter().all(|reason| {
                                    matches!(
                                        reason.as_str(),
                                        Some("invalid_splits" | "missing_ghost")
                                    )
                                })
                        })
                    })
                    && ["from", "to"].iter().all(|key| {
                        object.get(*key).is_none_or(|v| {
                            v.as_str().is_some_and(|s| {
                                s.len() <= 64 && s.parse::<jiff::Timestamp>().is_ok()
                            })
                        })
                    })
            }
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
                            && values.len() <= WORKSHOP_SCAN_BATCH_SIZE
                            && values
                                .iter()
                                .all(|value| value.as_str().is_some_and(valid_positive_decimal))
                    })
                    && optional_bool("fixZeepSDKExponentHashes")
            }
            Self::PrepareTrackTournamentLobbyAsset => positive_i64("idTournament"),
            Self::PrepareZslPracticePlaylist => {
                object.len() == 2
                    && positive_i64("roundId")
                    && object["roundId"]
                        .as_i64()
                        .is_some_and(|id| id <= i32::MAX as i64)
                    && object
                        .get("playlist")
                        .and_then(serde_json::Value::as_str)
                        .is_some_and(|url| zc_core::practice::validate_playlist_url(url).is_ok())
            }
            Self::PrepareZslWarmupPlaylist => {
                object.len() == 1
                    && positive_i64("roundId")
                    && object["roundId"]
                        .as_i64()
                        .is_some_and(|id| id <= i32::MAX as i64)
            }
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

fn valid_audit_ids(value: &serde_json::Value, allow_empty: bool) -> bool {
    value.as_array().is_some_and(|ids| {
        ids.len() <= 1000
            && (allow_empty || !ids.is_empty())
            && ids
                .iter()
                .all(|v| v.as_i64().is_some_and(|n| n > 0 && n <= i32::MAX.into()))
            && ids
                .iter()
                .filter_map(|v| v.as_i64())
                .collect::<std::collections::BTreeSet<_>>()
                .len()
                == ids.len()
    })
}

#[cfg(test)]
mod tests {
    use super::TaskIdentifier;

    #[test]
    fn task_registry_round_trips_all_identifiers() {
        assert_eq!(super::TaskIdentifier::ALL.len(), 24);
        for task in super::TaskIdentifier::ALL {
            assert_eq!(super::TaskIdentifier::parse(task.as_str()), Some(task));
        }
    }

    #[test]
    fn audit_checkpoints_are_bounded_and_private() {
        use serde_json::json;
        let payload = json!({"auditRunId":"42","work":{"recordIds":[1,2],"next":{"afterLevelId":1,"afterLevelRecordId":2,"throughId":200}}});
        assert!(TaskIdentifier::AuditRecordGhosts.validate_payload(&payload));
        assert!(!TaskIdentifier::AuditRecordGhosts.validate_external_payload(&payload));
        for ids in [
            json!([0]),
            json!([1, 1]),
            json!((1..=1001).collect::<Vec<_>>()),
        ] {
            assert!(
                !TaskIdentifier::AuditRecordGhosts
                    .validate_payload(&json!({"work":{"recordIds":ids,"next":null}}))
            );
        }
        assert!(!TaskIdentifier::AuditRecordGhosts.validate_payload(
            &json!({"work":{"recordIds":[],"next":{"work":{"recordIds":[],"next":null}}}})
        ));
    }
    #[test]
    fn payload_validation_matches_allowlist_contract() {
        use serde_json::json;
        assert!(
            TaskIdentifier::PrepareZslWarmupPlaylist
                .validate_external_payload(&json!({"roundId":50}))
        );
        for payload in [
            json!({"roundId":0}),
            json!({"roundId":2147483648_i64}),
            json!({"roundId":50,"extra":true}),
        ] {
            assert!(!TaskIdentifier::PrepareZslWarmupPlaylist.validate_external_payload(&payload));
        }
        assert!(TaskIdentifier::ValidateRecordGhost.compatible());
        assert!(TaskIdentifier::ValidateRecordGhost.validate_payload(&json!({"idRecord":1})));
        assert!(!TaskIdentifier::ValidateRecordGhost.validate_payload(&json!({"idRecord":0})));
        assert!(TaskIdentifier::AuditRecordGhosts.validate_payload(&json!({})));
        assert!(TaskIdentifier::AuditRecordGhosts.validate_payload(&json!({"afterId":100,"throughId":200,"idLevel":2,"workshopId":"3","from":"2026-01-01T00:00:00Z","to":"2027-01-01T00:00:00Z"})));
        for bound in [json!(-1), json!(2147483648_i64), json!("200")] {
            assert!(
                !TaskIdentifier::AuditRecordGhosts.validate_payload(&json!({"throughId":bound}))
            );
        }
        assert!(TaskIdentifier::AuditRecordGhosts.validate_payload(
            &json!({"idRecord":1276,"reasons":["invalid_splits","missing_ghost"]})
        ));
        for reasons in [
            json!([]),
            json!(["wrong_steam_id"]),
            json!(["missing_ghost", "missing_ghost", "missing_ghost"]),
        ] {
            assert!(
                !TaskIdentifier::AuditRecordGhosts.validate_payload(&json!({"reasons":reasons}))
            );
        }
        assert!(TaskIdentifier::AuditRecordGhosts.validate_payload(
            &json!({"afterId":100,"idLevel":2,"workshopId":"3","from":"2026-01-01T00:00:00Z"})
        ));
        assert!(!TaskIdentifier::AuditRecordGhosts.validate_payload(&json!({"from":"invalid"})));
        assert!(!TaskIdentifier::AuditRecordGhosts.validate_payload(&json!({"delete":true})));
        assert!(TaskIdentifier::BackfillLevelSimhash.compatible());
        assert_eq!(TaskIdentifier::BackfillLevelSimhash.max_attempts(), 3);
        assert!(TaskIdentifier::BackfillLevelSimhash.validate_payload(&json!({})));
        assert!(!TaskIdentifier::BackfillLevelSimhash.validate_payload(&json!({"all":true})));
        assert!(!TaskIdentifier::BackfillLevelSimhash.validate_payload(&json!([])));
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
