use serde_json::{Value, json};
use zc_core::{
    ghost_validation::*,
    ghosts::{GhostCapabilities, GhostFrame, GhostMetadata, ParsedGhost, Vector3},
};

#[test]
fn shared_v8_wire_fixture_preserves_initial_timestamp_and_absolute_sphere_samples() {
    let fixture: Value =
        serde_json::from_str(include_str!("../../../test/fixtures/ghost-v8.json")).unwrap();
    let ghost =
        zc_core::ghosts::parse_ghost(&hex::decode(fixture["lzmaHex"].as_str().unwrap()).unwrap())
            .unwrap();
    assert_eq!(ghost.version, 8);
    assert_eq!(ghost.metadata.steam_id.as_deref(), Some("42"));
    assert_eq!(ghost.frames[0].time, 1.2);
    assert_eq!(ghost.frames[1].position.x, 1.);
    assert_eq!(
        serde_json::to_value(ghost.evidence.unwrap()).unwrap(),
        serde_json::to_value(
            serde_json::from_value::<RunEvidence>(fixture["evidence"].clone()).unwrap()
        )
        .unwrap()
    );
}

#[test]
fn supplied_linked_checkpoint_fixtures_have_game_counts() {
    for (fixture, count, sizes) in [
        (
            include_str!("fixtures/ghost-validation/linked_checkpoints.json"),
            1,
            vec![2],
        ),
        (
            include_str!("fixtures/ghost-validation/linked_checkpoints_2.json"),
            2,
            vec![2, 3],
        ),
    ] {
        let graph = checkpoint_graph(&serde_json::from_str(fixture).unwrap());
        assert!(graph.reasons.is_empty());
        assert_eq!(graph.groups.len(), count);
        assert_eq!(graph.groups.iter().map(Vec::len).collect::<Vec<_>>(), sizes);
    }
    let gates: Value = serde_json::from_str(include_str!(
        "fixtures/ghost-validation/modes_as_checkpoints.json"
    ))
    .unwrap();
    assert_eq!(checkpoint_graph(&gates).groups.len(), 24);
    let mut disabled = gates.clone();
    for block in disabled.as_array_mut().unwrap() {
        block["d"]["n"]["ch5"] = json!(0);
    }
    assert!(checkpoint_graph(&disabled).groups.is_empty());
}
fn sample(time: f64, x: f64) -> SphereSample {
    SphereSample {
        time,
        position: [x, 0., 0.],
        radius: 0.9,
    }
}
fn cube() -> ColliderDefinition {
    ColliderDefinition {
        shape: "trigger".into(),
        convex: true,
        attributes: vec![],
        vertices: (0..8)
            .map(|n| {
                [
                    if n & 1 == 0 { -0.01 } else { 0.01 },
                    if n & 2 == 0 { -2. } else { 2. },
                    if n & 4 == 0 { -2. } else { 2. },
                ]
            })
            .collect(),
    }
}
fn fixture() -> (ParsedGhost, Value, ValidationManifest) {
    let mut ghost = ParsedGhost {
        version: 8,
        metadata: GhostMetadata {
            steam_id: Some("42".into()),
            ..Default::default()
        },
        capabilities: GhostCapabilities::default(),
        frames: vec![],
        evidence: Some(RunEvidence {
            sphere_sampling_version: 3,
            run_uuid: "00000000-0000-4000-8000-000000000001".into(),
            level_uid: "uid".into(),
            submission_level: "legacy".into(),
            canonical_hash: "a".repeat(32),
            initial_time: 0.,
            physics_interval: 0.02,
            samples: (0..=50)
                .map(|i| sample(f64::from(i) * 0.02, f64::from(i) / 5.))
                .collect(),
            events: vec![
                TriggerEvent {
                    block_uid: "cp".into(),
                    shape: "trigger".into(),
                    finish: false,
                    raw_time: 0.5,
                    adjusted_time: 0.5,
                    velocity_kmh: 36.,
                    sample: sample(0.5, 5.),
                },
                TriggerEvent {
                    block_uid: "finish".into(),
                    shape: "trigger".into(),
                    finish: true,
                    raw_time: 1.,
                    adjusted_time: 0.9,
                    velocity_kmh: 36.,
                    sample: sample(1., 10.),
                },
            ],
        }),
    };
    ghost.frames = ghost
        .evidence
        .as_ref()
        .unwrap()
        .samples
        .iter()
        .map(|s| GhostFrame {
            time: s.time,
            position: Vector3 {
                x: s.position[0],
                y: 0.,
                z: 0.,
            },
            ..Default::default()
        })
        .collect();
    let blocks = json!([{"i":1,"u":"start"},{"i":22,"u":"cp","p":{"x":5}},{"i":2,"u":"finish","p":{"x":10}}]);
    let manifest = ValidationManifest {
        version: 1,
        game_version: "18.2".into(),
        source_digest: "fixture".into(),
        calibrated: true,
        sphere_radius: 0.9,
        ragdoll_sphere_radius: None,
        physics_interval: 0.02,
        position_tolerance: 0.02,
        spawn_tolerance: 2.,
        blocks: [
            (
                "1".into(),
                BlockDefinition {
                    spawns: vec![[0., 0., 0.]],
                    ..Default::default()
                },
            ),
            (
                "22".into(),
                BlockDefinition {
                    colliders: vec![cube()],
                    ..Default::default()
                },
            ),
            (
                "2".into(),
                BlockDefinition {
                    colliders: vec![cube()],
                    ..Default::default()
                },
            ),
        ]
        .into_iter()
        .collect(),
    };
    (ghost, blocks, manifest)
}
fn context() -> SubmissionContext<'static> {
    SubmissionContext {
        steam_id: "42",
        canonical_hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        game_version: "18.2",
        time: 0.9,
        splits: &[0.5],
        speeds: &[36.],
    }
}
#[test]
fn unavailable_or_invalid_legacy_values_remain_uncertain_and_identity_still_fails() {
    let (template, blocks, manifest) = fixture();
    for version in 1..=7 {
        let mut ghost = template.clone();
        ghost.version = version;
        ghost.evidence = None;
        for (splits, speeds) in [
            (&[][..], &[][..]),
            (&[0.5][..], &[][..]),
            (&[][..], &[36.][..]),
            (&[0.5][..], &[36., 37.][..]),
            (&[-1.][..], &[36.][..]),
            (&[9.][..], &[-1.][..]),
            (&[f32::NAN][..], &[f32::INFINITY][..]),
        ] {
            let c = SubmissionContext {
                splits,
                speeds,
                ..context()
            };
            for identity in [None, Some("0".into()), Some("".into())] {
                ghost.metadata.steam_id = identity;
                let report = validate(&ghost, &c, Some(&blocks), Some(&manifest));
                assert_eq!(
                    report.status, "uncertain",
                    "V{version}: {:?}",
                    report.reasons
                );
                assert!(!report.reasons.contains(&"invalid_splits".into()));
            }
            ghost.metadata.steam_id = Some("43".into());
            let report = validate(&ghost, &c, Some(&blocks), None);
            assert_eq!(report.status, "fail");
            assert!(report.reasons.contains(&"wrong_steam_id".into()));
        }
    }
}
#[test]
fn v4_supports_splits_without_checkpoint_speeds() {
    let (mut ghost, blocks, manifest) = fixture();
    ghost.version = 4;
    ghost.evidence = None;
    let c = SubmissionContext {
        speeds: &[],
        ..context()
    };
    let report = validate(&ghost, &c, Some(&blocks), Some(&manifest));
    assert!(
        !report
            .reasons
            .iter()
            .any(|reason| reason.starts_with("legacy_telemetry_")),
        "{:?}",
        report.reasons
    );
    for version in 5..=7 {
        ghost.version = version;
        let report = validate(&ghost, &c, Some(&blocks), Some(&manifest));
        assert!(
            report
                .reasons
                .contains(&"legacy_telemetry_incomplete".into())
        );
        assert_eq!(report.status, "uncertain");
    }
}

#[test]
fn supplied_legacy_checkpoint_arrays_prove_shortfalls_without_manifest() {
    let (mut ghost, mut blocks, _) = fixture();
    let mut checkpoint = blocks
        .as_array()
        .unwrap()
        .iter()
        .find(|block| block["i"] == 22)
        .unwrap()
        .clone();
    checkpoint["u"] = json!("second-checkpoint");
    blocks.as_array_mut().unwrap().push(checkpoint);
    for version in 1..=7 {
        ghost.version = version;
        ghost.evidence = None;
        let report = validate(&ghost, &context(), Some(&blocks), None);
        assert_eq!(report.status, "fail", "V{version}: {:?}", report.reasons);
        assert!(
            report
                .reasons
                .contains(&"missing_checkpoint_telemetry".into())
        );
    }
}
#[test]
fn legacy_count_shortfalls_use_linked_groups_and_ignore_missing_telemetry() {
    let (mut ghost, _, _) = fixture();
    let blocks: Value = serde_json::from_str(include_str!(
        "fixtures/ghost-validation/linked_checkpoints_2.json"
    ))
    .unwrap();
    for version in 1..=7 {
        ghost.version = version;
        ghost.evidence = None;
        for (splits, speeds, expected) in [
            (&[][..], &[][..], "uncertain"),
            (&[0.2][..], &[][..], "fail"),
            (&[][..], &[36.][..], "fail"),
            (&[0.2, 0.5][..], &[][..], "uncertain"),
            (&[][..], &[36., 37.][..], "uncertain"),
            (&[0.2, 0.5][..], &[36., 37.][..], "uncertain"),
        ] {
            let report = validate(
                &ghost,
                &SubmissionContext {
                    splits,
                    speeds,
                    ..context()
                },
                Some(&blocks),
                None,
            );
            assert_eq!(report.status, expected, "V{version}: {:?}", report.reasons);
        }
    }
}
#[test]
fn continuous_legacy_trajectory_proves_distant_missing_checkpoint() {
    let (mut ghost, mut blocks, mut manifest) = fixture();
    blocks
        .as_array_mut()
        .unwrap()
        .push(json!({"i":22,"u":"missed","p":{"x":50}}));
    manifest.calibrated = false;
    ghost.evidence = None;
    ghost.frames = (0..=50)
        .map(|i| GhostFrame {
            time: f64::from(i) * 0.02,
            position: Vector3 {
                x: f64::from(i) * 0.2,
                y: 0.,
                z: 0.,
            },
            ..Default::default()
        })
        .collect();
    let context = SubmissionContext {
        splits: &[],
        speeds: &[],
        ..context()
    };
    for version in 1..=7 {
        ghost.version = version;
        let report = validate(&ghost, &context, Some(&blocks), Some(&manifest));
        assert_eq!(report.status, "fail", "V{version}: {:?}", report.reasons);
        assert_eq!(report.missing_groups, vec![vec!["missed"]]);
        assert!(report.reasons.contains(&"missing_checkpoint_groups".into()));
        ghost.frames[10].ragdoll = Some(true);
        assert_eq!(
            validate(&ghost, &context, Some(&blocks), Some(&manifest)).status,
            "uncertain"
        );
        ghost.frames[10].ragdoll = None;
    }
    let mut nearby = blocks.clone();
    nearby[3]["p"]["x"] = json!(12);
    assert_eq!(
        validate(&ghost, &context, Some(&nearby), Some(&manifest)).status,
        "uncertain",
        "car-root offset envelope must prevent near-contact failures"
    );
    let mut linked = blocks.clone();
    linked[3]["d"] = json!({"n":{"id0":1},"t":{"id0-0":"{\"t\":\"cp\",\"c\":0,\"a\":true}"}});
    let report = validate(&ghost, &context, Some(&linked), Some(&manifest));
    assert_eq!(report.status, "uncertain");
    assert!(report.missing_groups.is_empty());
    ghost.frames.drain(10..30);
    assert_eq!(
        validate(&ghost, &context, Some(&blocks), Some(&manifest)).status,
        "uncertain"
    );
}
#[test]
fn uncertain_checkpoint_links_cannot_prove_legacy_count_shortfall() {
    let (mut ghost, _, _) = fixture();
    ghost.version = 5;
    ghost.evidence = None;
    let blocks = json!([
        {"i":22,"u":"one","d":{"n":{"id0":1},"t":{"id0-0":"invalid"}}},
        {"i":22,"u":"two"}
    ]);
    let report = validate(&ghost, &context(), Some(&blocks), None);
    assert_eq!(report.status, "uncertain");
    assert!(
        !report
            .reasons
            .contains(&"missing_checkpoint_telemetry".into())
    );
}
#[test]
fn v8_zero_checkpoint_level_passes_with_empty_telemetry() {
    let (mut ghost, mut blocks, manifest) = fixture();
    blocks
        .as_array_mut()
        .unwrap()
        .retain(|block| block["i"] != 22);
    ghost
        .evidence
        .as_mut()
        .unwrap()
        .events
        .retain(|event| event.finish);
    let c = SubmissionContext {
        splits: &[],
        speeds: &[],
        ..context()
    };
    let report = validate(&ghost, &c, Some(&blocks), Some(&manifest));
    assert_eq!(report.status, "pass", "{:?}", report.reasons);
    assert!(report.matched_groups.is_empty());
    assert!(report.missing_groups.is_empty());
}
#[test]
fn v8_split_and_event_checks_remain_strict() {
    let (ghost, blocks, manifest) = fixture();
    for (splits, speeds, reason) in [
        (&[0.5][..], &[][..], "invalid_splits"),
        (&[-1.][..], &[36.][..], "invalid_splits"),
        (&[0.5][..], &[-1.][..], "invalid_splits"),
        (&[][..], &[][..], "event_split_count_mismatch"),
        (&[0.4][..], &[36.][..], "event_split_values_mismatch"),
    ] {
        let c = SubmissionContext {
            splits,
            speeds,
            ..context()
        };
        let report = validate(&ghost, &c, Some(&blocks), Some(&manifest));
        assert_eq!(report.status, "fail");
        assert!(
            report.reasons.contains(&reason.into()),
            "{:?}",
            report.reasons
        );
    }
}
#[test]
fn calibrated_run_checks_finish_correction_and_every_checkpoint() {
    let (ghost, blocks, manifest) = fixture();
    let context = context();
    let report = validate(&ghost, &context, Some(&blocks), Some(&manifest));
    assert_eq!(report.status, "pass", "{:?}", report.reasons);
    assert_eq!(report.matched_groups, vec![vec!["cp"]]);
    let mut changed = blocks.clone();
    changed
        .as_array_mut()
        .unwrap()
        .push(json!({"i":22,"u":"new","p":{"x":500}}));
    let report = validate(&ghost, &context, Some(&changed), Some(&manifest));
    assert_eq!(report.status, "fail");
    assert!(report.reasons.contains(&"missing_checkpoint_groups".into()));
}
#[test]
fn missing_data_and_uncalibrated_geometry_never_prove_checkpoint_failure() {
    let (mut ghost, mut blocks, mut manifest) = fixture();
    manifest.calibrated = false;
    blocks
        .as_array_mut()
        .unwrap()
        .push(json!({"i":22,"u":"missing","p":{"x":500}}));
    assert_eq!(
        validate(&ghost, &context(), None, Some(&manifest)).status,
        "uncertain"
    );
    assert_eq!(
        validate(&ghost, &context(), Some(&blocks), Some(&manifest)).status,
        "uncertain"
    );
    ghost.evidence.as_mut().unwrap().samples.remove(10);
    manifest.calibrated = true;
    assert_eq!(
        validate(&ghost, &context(), Some(&blocks), Some(&manifest)).status,
        "uncertain"
    );
    ghost.evidence = None;
    ghost.version = 7;
    ghost.frames[0].ragdoll = Some(true);
    let absent_telemetry = SubmissionContext {
        splits: &[],
        speeds: &[],
        ..context()
    };
    assert_eq!(
        validate(&ghost, &absent_telemetry, Some(&blocks), Some(&manifest)).status,
        "uncertain"
    );
}
#[test]
fn identity_failure_survives_missing_geometry() {
    let (ghost, _, _) = fixture();
    let c = SubmissionContext {
        steam_id: "43",
        ..context()
    };
    assert!(
        validate(&ghost, &c, None, None)
            .reasons
            .contains(&"wrong_steam_id".into())
    );
}

#[test]
fn builder_controlled_level_aliases_do_not_change_validation_identity() {
    let (mut ghost, blocks, manifest) = fixture();
    let evidence = ghost.evidence.as_mut().unwrap();
    evidence.level_uid = "edited-arbitrary-alias".into();
    evidence.submission_level = "different-submission-alias".into();
    assert_eq!(
        validate(&ghost, &context(), Some(&blocks), Some(&manifest)).status,
        "pass"
    );
    ghost.evidence.as_mut().unwrap().canonical_hash = "b".repeat(32);
    assert!(
        validate(&ghost, &context(), Some(&blocks), Some(&manifest))
            .reasons
            .contains(&"wrong_level_identity".into())
    );
}

#[test]
fn live_captures_preserve_provisional_results_and_recording_defects() {
    for (index, raw) in [
        include_str!("fixtures/ghost-validation/live-capture-1.json"),
        include_str!("fixtures/ghost-validation/live-capture-2.json"),
        include_str!("fixtures/ghost-validation/live-capture-3.json"),
    ]
    .iter()
    .enumerate()
    {
        let fixture: Value = serde_json::from_str(raw).unwrap();
        let frames = fixture["frames"]
            .as_array()
            .unwrap()
            .iter()
            .map(|frame| GhostFrame {
                time: frame["time"].as_f64().unwrap(),
                ragdoll: frame["ragdoll"].as_bool(),
                ..Default::default()
            })
            .collect();
        let ghost = ParsedGhost {
            version: 8,
            metadata: GhostMetadata {
                steam_id: Some("42".into()),
                ..Default::default()
            },
            capabilities: GhostCapabilities::default(),
            frames,
            evidence: Some(serde_json::from_value(fixture["evidence"].clone()).unwrap()),
        };
        let mut manifest: ValidationManifest =
            serde_json::from_value(fixture["manifest"].clone()).unwrap();
        let splits: Vec<f32> = serde_json::from_value(fixture["splits"].clone()).unwrap();
        let speeds: Vec<f32> = serde_json::from_value(fixture["speeds"].clone()).unwrap();
        let context = SubmissionContext {
            steam_id: "42",
            canonical_hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            game_version: fixture["gameVersion"].as_str().unwrap(),
            time: fixture["time"].as_f64().unwrap(),
            splits: &splits,
            speeds: &speeds,
        };
        let report = validate(&ghost, &context, Some(&fixture["blocks"]), Some(&manifest));
        assert_eq!(report.status, "uncertain");
        assert!(report.reasons.contains(&"uncalibrated_profile".into()));
        assert!(!report.reasons.contains(&"unsupported_game_version".into()));
        // Explicit diagnostic comparison only. No deployed profile is calibrated here.

        manifest.physics_interval = 0.011;
        manifest.sphere_radius = 0.3;
        manifest.calibrated = true;
        let report = validate(&ghost, &context, Some(&fixture["blocks"]), Some(&manifest));
        assert!(
            !report.reasons.contains(&"incomplete_samples".into()),
            "{:?}",
            report.reasons
        );
        if index < 2 {
            assert_eq!(report.status, "uncertain", "{:?}", report.reasons);
            assert!(
                report
                    .reasons
                    .contains(&"unsupported_trigger_sphere_sampling".into())
            );
            assert_eq!(report.matched_groups.len(), if index == 1 { 2 } else { 0 });
        } else {
            assert_eq!(report.status, "uncertain", "{:?}", report.reasons);
            assert!(
                report
                    .reasons
                    .contains(&"unsupported_ragdoll_sphere_sampling".into())
            );
            assert!(report.reasons.contains(&"missing_finish_contact".into()));
            assert_eq!(
                ghost
                    .frames
                    .iter()
                    .filter(|frame| frame.ragdoll == Some(true))
                    .count(),
                333
            );
        }
    }
}
#[test]
fn older_sampling_revision_cannot_prove_missing_geometry_contact() {
    let (mut ghost, blocks, manifest) = fixture();
    let evidence = ghost.evidence.as_mut().unwrap();
    evidence.sphere_sampling_version = 2;
    evidence.events.last_mut().unwrap().sample.position = [100., 0., 0.];
    let report = validate(&ghost, &context(), Some(&blocks), Some(&manifest));
    assert_eq!(report.status, "uncertain");
    assert!(report.reasons.contains(&"missing_finish_contact".into()));
    assert!(
        report
            .reasons
            .contains(&"unsupported_trigger_sphere_sampling".into())
    );
}

#[test]
fn updated_live_captures_keep_wrong_body_evidence_uncertain() {
    let captures = [
        include_str!("fixtures/ghost-validation/updated-capture-1.json"),
        include_str!("fixtures/ghost-validation/updated-capture-2.json"),
        include_str!("fixtures/ghost-validation/updated-capture-3.json"),
        include_str!("fixtures/ghost-validation/updated-capture-4.json"),
        include_str!("fixtures/ghost-validation/updated-capture-5.json"),
        include_str!("fixtures/ghost-validation/updated-capture-6.json"),
        include_str!("fixtures/ghost-validation/updated-capture-7.json"),
        include_str!("fixtures/ghost-validation/updated-capture-8.json"),
        include_str!("fixtures/ghost-validation/updated-capture-9.json"),
        include_str!("fixtures/ghost-validation/updated-capture-10.json"),
        include_str!("fixtures/ghost-validation/updated-capture-11.json"),
        include_str!("fixtures/ghost-validation/updated-capture-12.json"),
        include_str!("fixtures/ghost-validation/updated-capture-13.json"),
        include_str!("fixtures/ghost-validation/updated-capture-14.json"),
    ];
    for (index, raw) in captures.iter().enumerate() {
        let fixture: Value = serde_json::from_str(raw).unwrap();
        let ghost = ParsedGhost {
            version: 8,
            metadata: GhostMetadata {
                steam_id: Some("42".into()),
                ..Default::default()
            },
            capabilities: GhostCapabilities::default(),
            frames: fixture["frames"]
                .as_array()
                .unwrap()
                .iter()
                .map(|frame| GhostFrame {
                    time: frame["time"].as_f64().unwrap(),
                    ragdoll: frame["ragdoll"].as_bool(),
                    ..Default::default()
                })
                .collect(),
            evidence: Some(serde_json::from_value(fixture["evidence"].clone()).unwrap()),
        };
        let mut manifest: ValidationManifest =
            serde_json::from_value(fixture["manifest"].clone()).unwrap();
        let splits: Vec<f32> = serde_json::from_value(fixture["splits"].clone()).unwrap();
        let speeds: Vec<f32> = serde_json::from_value(fixture["speeds"].clone()).unwrap();
        let context = SubmissionContext {
            steam_id: "42",
            canonical_hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            game_version: fixture["gameVersion"].as_str().unwrap(),
            time: fixture["time"].as_f64().unwrap(),
            splits: &splits,
            speeds: &speeds,
        };
        let report = validate(&ghost, &context, Some(&fixture["blocks"]), Some(&manifest));
        assert_eq!(
            report.status,
            "uncertain",
            "capture {}: {:?}",
            index + 1,
            report.reasons
        );
        assert!(report.reasons.contains(&"uncalibrated_profile".into()));
        assert!(!report.reasons.contains(&"unsupported_game_version".into()));
        // Diagnostic override cannot make wrong-body samples prove an invalid run.

        manifest.calibrated = true;
        let report = validate(&ghost, &context, Some(&fixture["blocks"]), Some(&manifest));
        assert_eq!(
            report.status,
            "uncertain",
            "capture {}: {:?}",
            index + 1,
            report.reasons
        );
        assert!(
            report
                .reasons
                .contains(&"unsupported_trigger_sphere_sampling".into())
        );
        if index == 1 {
            assert!(report.reasons.contains(&"event_geometry_mismatch".into()));
            assert!(report.reasons.contains(&"missing_finish_contact".into()));
        }
        if (3..7).contains(&index) {
            assert!(
                report
                    .reasons
                    .contains(&"unsupported_ragdoll_sphere_sampling".into())
            );
            assert!(report.reasons.contains(&"missing_finish_event".into()));
        }
        assert_eq!(
            report.matched_groups.len(),
            [2, 0, 0, 0, 0, 0, 0, 4, 4, 6, 3, 3, 5, 5][index]
        );
    }
}

#[test]
fn revision3_live_captures_match_geometry_and_complete_ragdoll_finish() {
    let captures = [
        include_str!("fixtures/ghost-validation/revision3-capture-1.json"),
        include_str!("fixtures/ghost-validation/revision3-capture-2.json"),
        include_str!("fixtures/ghost-validation/revision3-capture-3.json"),
        include_str!("fixtures/ghost-validation/revision3-capture-4.json"),
        include_str!("fixtures/ghost-validation/revision3-capture-5.json"),
        include_str!("fixtures/ghost-validation/revision3-capture-6.json"),
        include_str!("fixtures/ghost-validation/revision3-capture-7.json"),
        include_str!("fixtures/ghost-validation/revision3-capture-8.json"),
        include_str!("fixtures/ghost-validation/revision3-capture-9.json"),
        include_str!("fixtures/ghost-validation/revision3-capture-10.json"),
    ];
    for (index, raw) in captures.iter().enumerate() {
        let fixture: Value = serde_json::from_str(raw).unwrap();
        let ghost = ParsedGhost {
            version: 8,
            metadata: GhostMetadata {
                steam_id: Some("42".into()),
                ..Default::default()
            },
            capabilities: GhostCapabilities::default(),
            frames: fixture["frames"]
                .as_array()
                .unwrap()
                .iter()
                .map(|frame| GhostFrame {
                    time: frame["time"].as_f64().unwrap(),
                    ragdoll: frame["ragdoll"].as_bool(),
                    ..Default::default()
                })
                .collect(),
            evidence: Some(serde_json::from_value(fixture["evidence"].clone()).unwrap()),
        };
        let mut manifest: ValidationManifest =
            serde_json::from_value(fixture["manifest"].clone()).unwrap();
        let splits: Vec<f32> = serde_json::from_value(fixture["splits"].clone()).unwrap();
        let speeds: Vec<f32> = serde_json::from_value(fixture["speeds"].clone()).unwrap();
        let context = SubmissionContext {
            steam_id: "42",
            canonical_hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            game_version: fixture["gameVersion"].as_str().unwrap(),
            time: fixture["time"].as_f64().unwrap(),
            splits: &splits,
            speeds: &speeds,
        };
        let report = validate(&ghost, &context, Some(&fixture["blocks"]), Some(&manifest));
        assert_eq!(report.status, "uncertain");
        assert!(report.reasons.contains(&"uncalibrated_profile".into()));
        assert!(!report.reasons.contains(&"unsupported_game_version".into()));
        // In-memory geometry comparison only; deployed manifest stays uncalibrated.

        manifest.calibrated = true;
        let report = validate(&ghost, &context, Some(&fixture["blocks"]), Some(&manifest));
        if index == 6 || index == 8 {
            assert_eq!(report.status, "uncertain");
            assert_eq!(report.reasons, vec!["csv_event_identity_unknown"]);
        } else {
            assert_eq!(
                report.status,
                "pass",
                "capture {}: {:?}",
                index + 1,
                report.reasons
            );
        }
        assert_eq!(
            report.matched_groups.len(),
            [2, 0, 0, 0, 3, 3, 6, 4, 4, 3][index]
        );
        assert!(report.missing_groups.is_empty());
        if index == 3 {
            assert_eq!(
                ghost
                    .frames
                    .iter()
                    .filter(|frame| frame.ragdoll == Some(true))
                    .count(),
                329
            );
            let evidence = ghost.evidence.as_ref().unwrap();
            assert_eq!(
                evidence.samples.last().unwrap().time,
                evidence.events.last().unwrap().raw_time
            );
            assert!(evidence.events.last().unwrap().finish);
        }
    }
}

#[test]
fn late_live_captures_cover_nine_checkpoints_and_logic_sampling_offset() {
    for (index, raw) in [
        include_str!("fixtures/ghost-validation/late-capture-nine-checkpoints.json"),
        include_str!("fixtures/ghost-validation/late-capture-logic-event-offset.json"),
        include_str!("fixtures/ghost-validation/late-capture-logic.json"),
    ]
    .iter()
    .enumerate()
    {
        let fixture: Value = serde_json::from_str(raw).unwrap();
        let ghost = ParsedGhost {
            version: 8,
            metadata: GhostMetadata {
                steam_id: Some("42".into()),
                ..Default::default()
            },
            capabilities: GhostCapabilities::default(),
            frames: fixture["frames"]
                .as_array()
                .unwrap()
                .iter()
                .map(|frame| GhostFrame {
                    time: frame["time"].as_f64().unwrap(),
                    ragdoll: frame["ragdoll"].as_bool(),
                    ..Default::default()
                })
                .collect(),
            evidence: Some(serde_json::from_value(fixture["evidence"].clone()).unwrap()),
        };
        let mut manifest: ValidationManifest =
            serde_json::from_value(fixture["manifest"].clone()).unwrap();
        let splits: Vec<f32> = serde_json::from_value(fixture["splits"].clone()).unwrap();
        let speeds: Vec<f32> = serde_json::from_value(fixture["speeds"].clone()).unwrap();
        let context = SubmissionContext {
            steam_id: "42",
            canonical_hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            game_version: fixture["gameVersion"].as_str().unwrap(),
            time: fixture["time"].as_f64().unwrap(),
            splits: &splits,
            speeds: &speeds,
        };
        let report = validate(&ghost, &context, Some(&fixture["blocks"]), Some(&manifest));
        assert_eq!(report.status, "uncertain");
        assert!(report.reasons.contains(&"uncalibrated_profile".into()));
        assert!(!report.reasons.contains(&"unsupported_game_version".into()));
        // Diagnostic override only; no profile or acceptance policy changes.

        manifest.calibrated = true;
        let report = validate(&ghost, &context, Some(&fixture["blocks"]), Some(&manifest));
        assert_eq!(report.matched_groups.len(), if index == 0 { 9 } else { 6 });
        assert!(report.missing_groups.is_empty());
        if index == 0 {
            assert_eq!(report.status, "pass", "{:?}", report.reasons);
            // Negative control: an added required checkpoint cannot be satisfied by older trajectory.
            let mut blocks = fixture["blocks"].clone();
            let mut checkpoint = blocks
                .as_array()
                .unwrap()
                .iter()
                .find(|block| block["i"] == 1278)
                .unwrap()
                .clone();
            checkpoint["u"] = json!("added-checkpoint");
            checkpoint["p"] = json!({"x":10000,"y":10000,"z":10000});
            blocks.as_array_mut().unwrap().push(checkpoint);
            let report = validate(&ghost, &context, Some(&blocks), Some(&manifest));
            assert_eq!(report.status, "fail");
            assert_eq!(report.missing_groups, vec![vec!["added-checkpoint"]]);
            assert!(report.reasons.contains(&"missing_checkpoint_groups".into()));
            manifest.calibrated = false;
            assert_eq!(
                validate(&ghost, &context, Some(&blocks), Some(&manifest)).status,
                "uncertain"
            );
        } else {
            assert_eq!(report.status, "uncertain");
            let expected = if index == 1 {
                vec!["logic_controlled_trigger", "event_trajectory_mismatch"]
            } else {
                vec!["logic_controlled_trigger"]
            };
            assert_eq!(report.reasons, expected);
        }
    }
}

#[test]
fn game_release_labels_do_not_gate_geometry_validation() {
    let (ghost, blocks, mut manifest) = fixture();
    manifest.game_version = "source-export-release".into();
    for run_version in ["weekly-patch", "future-release", "99.1234"] {
        let mut context = context();
        context.game_version = run_version;
        let report = validate(&ghost, &context, Some(&blocks), Some(&manifest));
        assert_eq!(report.status, "pass", "{:?}", report.reasons);
        assert_eq!(manifest.game_version, "source-export-release");
    }
    manifest.calibrated = false;
    let mut context = context();
    context.game_version = "future-release";
    assert!(
        validate(&ghost, &context, Some(&blocks), Some(&manifest))
            .reasons
            .contains(&"uncalibrated_profile".into())
    );
    manifest.calibrated = true;
    manifest.version = 2;
    let report = validate(&ghost, &context, Some(&blocks), Some(&manifest));
    assert_eq!(report.status, "uncertain");
    assert!(
        report
            .reasons
            .contains(&"unsupported_manifest_version".into())
    );
}

#[test]
fn changed_trigger_geometry_remains_uncertain_without_release_gating() {
    let (ghost, mut blocks, manifest) = fixture();
    blocks[2]["p"]["x"] = json!(100);
    let mut context = context();
    context.game_version = "future-release";
    let report = validate(&ghost, &context, Some(&blocks), Some(&manifest));
    assert_eq!(report.status, "uncertain");
    assert!(report.reasons.contains(&"event_geometry_mismatch".into()));
    assert!(report.reasons.contains(&"missing_finish_contact".into()));
    context.steam_id = "43";
    assert_eq!(
        validate(&ghost, &context, Some(&blocks), Some(&manifest)).status,
        "fail"
    );
}

#[test]
fn trusted_radius_changes_with_ragdoll_state() {
    let (mut ghost, blocks, mut manifest) = fixture();
    manifest.ragdoll_sphere_radius = Some(0.6);
    for frame in &mut ghost.frames {
        frame.ragdoll = Some(frame.time >= 0.5);
    }
    let evidence = ghost.evidence.as_mut().unwrap();
    for sample in &mut evidence.samples {
        if sample.time >= 0.5 {
            sample.radius = 0.6;
        }
    }
    for event in &mut evidence.events {
        if event.sample.time >= 0.5 {
            event.sample.radius = 0.6;
        }
    }
    assert_eq!(
        validate(&ghost, &context(), Some(&blocks), Some(&manifest)).status,
        "pass"
    );
    manifest.ragdoll_sphere_radius = None;
    let report = validate(&ghost, &context(), Some(&blocks), Some(&manifest));
    assert_eq!(report.status, "uncertain");
    assert!(report.reasons.contains(&"incomplete_samples".into()));
}

#[test]
fn finish_contact_cannot_be_replaced_by_earlier_crossing() {
    let (mut ghost, blocks, manifest) = fixture();
    let evidence = ghost.evidence.as_mut().unwrap();
    evidence.events[1].sample = sample(1., 50.);
    evidence.samples.last_mut().unwrap().position[0] = 50.;
    assert!(
        validate(&ghost, &context(), Some(&blocks), Some(&manifest))
            .reasons
            .contains(&"missing_finish_contact".into())
    );
}

#[test]
fn missing_finish_sample_and_nonconvex_shapes_remain_uncertain() {
    let (mut ghost, blocks, mut manifest) = fixture();
    ghost.evidence.as_mut().unwrap().samples.truncate(30);
    let report = validate(&ghost, &context(), Some(&blocks), Some(&manifest));
    assert_eq!(report.status, "uncertain");
    let (ghost, _, _) = fixture();
    manifest.blocks.get_mut("22").unwrap().colliders[0].convex = false;
    assert_eq!(
        validate(&ghost, &context(), Some(&blocks), Some(&manifest)).status,
        "uncertain"
    );
}
#[test]
fn linked_checkpoint_metadata_matches_parser_counts() {
    let blocks: Value = serde_json::from_str(include_str!(
        "fixtures/ghost-validation/linked_checkpoints_2.json"
    ))
    .unwrap();
    let parsed = zc_core::levels::parse_json_level(
        &json!({"level":{"UID":"fixture"},"blox":blocks}).to_string(),
        false,
    )
    .unwrap();
    assert_eq!(parsed.amount_checkpoints, 2);
}

#[test]
fn every_checkpoint_shape_selects_only_active_collider() {
    for index in 0..6 {
        let (mut ghost, mut blocks, mut manifest) = fixture();
        let mut colliders = Vec::new();
        for shape in 0..6 {
            let mut collider = cube();
            collider.shape = format!("shape-{shape}");
            collider.attributes = vec![format!("a{shape}")];
            if shape != index {
                for point in &mut collider.vertices {
                    point[1] += 100.;
                }
            }
            colliders.push(collider);
            blocks[1]["d"]["n"][format!("a{shape}")] = json!(if shape == index { 1 } else { 0 });
        }
        manifest.blocks.get_mut("22").unwrap().colliders = colliders;
        ghost.evidence.as_mut().unwrap().events[0].shape = format!("shape-{index}");
        let report = validate(&ghost, &context(), Some(&blocks), Some(&manifest));
        assert_eq!(report.status, "pass", "{:?}", report.reasons);
    }
}

#[test]
#[ignore = "manual synthetic latency measurement; not live-game calibration"]
fn measure_synthetic_validation_latency() {
    let (ghost, blocks, manifest) = fixture();
    let context = context();
    let start = std::time::Instant::now();
    for _ in 0..100 {
        assert_eq!(
            validate(&ghost, &context, Some(&blocks), Some(&manifest)).status,
            "pass"
        );
    }
    println!(
        "Synthetic validation: 51 samples, 2 triggers, 100 runs, mean {} microseconds",
        start.elapsed().as_micros() / 100
    );
}

#[test]
fn csv_without_persisted_trigger_uids_cannot_prove_event_failure() {
    let (ghost, _, manifest) = fixture();
    let blocks = json!([{"Id":1,"Position":{"X":0,"Y":0,"Z":0},"Euler":{"X":0,"Y":0,"Z":0},"Scale":{"X":1,"Y":1,"Z":1},"Options":[]}]);
    let report = validate(&ghost, &context(), Some(&blocks), Some(&manifest));
    assert_eq!(report.status, "uncertain");
    assert!(
        report
            .reasons
            .contains(&"csv_event_identity_unknown".into())
    );
}

#[test]
#[ignore = "synthetic latency benchmark; no live-game performance claim"]
fn measure_validation_scaling() {
    for count in [0, 10, 100] {
        let (mut ghost, _, manifest) = fixture();
        let evidence = ghost.evidence.as_mut().unwrap();
        evidence.samples = (0..=2000)
            .map(|i| sample(f64::from(i) * 0.02, f64::from(i) * 0.2))
            .collect();
        evidence.events.clear();
        let mut blocks = json!([{"i":1,"u":"start"},{"i":2,"u":"finish","p":{"x":400}}]);
        let mut splits = Vec::new();
        let speeds = vec![36.; count];
        for index in 0..count {
            let tick = (index + 1) * 2000 / (count + 1);
            let time = tick as f64 * 0.02;
            let position = time * 10.;
            let uid = format!("cp-{index}");
            blocks
                .as_array_mut()
                .unwrap()
                .push(json!({"i":22,"u":uid,"p":{"x":position}}));
            evidence.events.push(TriggerEvent {
                block_uid: uid,
                shape: "trigger".into(),
                finish: false,
                raw_time: time,
                adjusted_time: time,
                velocity_kmh: 36.,
                sample: sample(time, position),
            });
            splits.push(time as f32);
        }
        evidence.events.push(TriggerEvent {
            block_uid: "finish".into(),
            shape: "trigger".into(),
            finish: true,
            raw_time: 40.,
            adjusted_time: 39.9,
            velocity_kmh: 36.,
            sample: sample(40., 400.),
        });
        let mut context = context();
        context.time = 39.9;
        context.splits = &splits;
        context.speeds = &speeds;
        let mut timings = Vec::new();
        for _ in 0..10 {
            let start = std::time::Instant::now();
            let report = validate(&ghost, &context, Some(&blocks), Some(&manifest));
            assert_eq!(report.status, "pass", "{:?}", report.reasons);
            timings.push(start.elapsed().as_micros());
        }
        timings.sort_unstable();
        println!(
            "samples=2001 checkpoints={count} median_us={} p95_us={}",
            timings[5], timings[9]
        );
    }
}
