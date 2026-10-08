mod decode;
mod proto;
mod statistics;
mod types;

pub const MAX_GHOST_COMPRESSED_BYTES: usize = 24 * 1024 * 1024;
pub const MAX_GHOST_DECOMPRESSED_BYTES: usize = 64 * 1024 * 1024;
pub const MAX_GHOST_FRAMES: usize = 120_000;

pub use decode::{GhostError, parse_ghost};
pub use statistics::calculate_ghost_statistics;
pub use types::{
    GhostCapabilities, GhostCosmetics, GhostFrame, GhostMetadata, GhostStatistics, ParsedGhost,
    Quaternion, Surface, Vector2, Vector3,
};

pub fn parse_ghost_statistics(input: &[u8]) -> Result<GhostStatistics, GhostError> {
    let ghost = parse_ghost(input)?;
    Ok(calculate_ghost_statistics(&ghost.frames, ghost.version))
}

#[cfg(test)]
mod tests {
    use std::io::Write;

    use flate2::{Compression, write::GzEncoder};
    use prost::Message;

    use super::*;

    fn protobuf_surface_ghost(version: i32, surface_state: i32) -> Vec<u8> {
        let ghost = proto::Ghost {
            version,
            evidence_json: r#"{"runUuid":"test-run","levelUid":"test-level","submissionLevel":"","canonicalHash":"","initialTime":0,"physicsInterval":0.02,"samples":[],"events":[]}"#.to_owned(),
            initial_frame: Some(proto::InitialFrame {
                position: Some(proto::Vector3::default()),
                surface_state,
                ..Default::default()
            }),
            delta_frames: vec![proto::DeltaFrame {
                time: 1.0,
                position: Some(proto::Vector3Int { x: 100_000, y: 0, z: 0 }),
                ..Default::default()
            }],
            ..Default::default()
        };
        let mut compressed = Vec::new();
        lzma_rs::lzma_compress(
            &mut std::io::Cursor::new(ghost.encode_to_vec()),
            &mut compressed,
        )
        .expect("compress protobuf ghost");
        compressed
    }

    #[test]
    fn distinguishes_surface_support_from_detected_samples() {
        for version in [5, 6, 7, 8] {
            let payload = protobuf_surface_ghost(version, 0);
            let ghost = parse_ghost(&payload).expect("surface ghost");
            let statistics = parse_ghost_statistics(&payload).expect("surface statistics");
            assert_eq!(ghost.capabilities.surfaces, version >= 6);
            assert_eq!(statistics.has_surface_data, version >= 6);
            if version >= 7 {
                assert!(ghost.frames.iter().all(|frame| frame.surfaces.is_empty()));
                assert_eq!(statistics.distance_on_tarmac, Some(0.0));
                assert_eq!(statistics.time_on_tarmac, Some(0.0));
            } else if version == 5 {
                assert_eq!(statistics.distance_on_tarmac, None);
                assert_eq!(statistics.time_on_tarmac, None);
            }
        }
    }

    #[test]
    fn preserves_version_specific_surface_bits_and_statistics() {
        for version in [6, 7, 8] {
            let payload = protobuf_surface_ghost(version, 1 << 4);
            let ghost = parse_ghost(&payload).expect("surface ghost");
            let statistics = parse_ghost_statistics(&payload).expect("surface statistics");
            if version == 6 {
                assert_eq!(ghost.frames[0].surfaces, vec![Surface::Ice1]);
                assert_eq!(statistics.distance_on_ice1, Some(1.0));
                assert_eq!(statistics.time_on_ice1, Some(1.0));
            } else {
                assert_eq!(ghost.frames[0].surfaces, vec![Surface::Wood]);
                assert_eq!(statistics.distance_on_wood, Some(1.0));
                assert_eq!(statistics.time_on_wood, Some(1.0));
            }
        }
    }

    fn v1_payload() -> Vec<u8> {
        let mut bytes = Vec::new();
        bytes.extend(1_i32.to_le_bytes());
        bytes.extend(2_i32.to_le_bytes());
        for value in [0.0_f32, 0.0, 0.0, 0.0, 0.0, 90.0, 0.0] {
            bytes.extend(value.to_le_bytes());
        }
        for value in [1.0_f32, 10.0, 0.0, 0.0, 0.0, 90.0, 0.0] {
            bytes.extend(value.to_le_bytes());
        }
        bytes
    }

    #[test]
    fn parses_raw_and_gzip_legacy_ghosts() {
        let payload = v1_payload();
        let raw = parse_ghost(&payload).expect("raw V1 ghost");
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(&payload).expect("gzip write");
        let gzip = parse_ghost(&encoder.finish().expect("gzip finish")).expect("gzip V1 ghost");

        assert_eq!(raw, gzip);
        assert_eq!(raw.version, 1);
        assert_eq!(raw.frames.len(), 2);
        assert!(
            (raw.frames[0].orientation.expect("orientation").y - std::f64::consts::FRAC_1_SQRT_2)
                .abs()
                < 1e-6
        );
        let statistics = calculate_ghost_statistics(&raw.frames, raw.version);
        assert_eq!(statistics.frame_count, Some(2));
        assert_eq!(statistics.distance, Some(10.0));
        assert_eq!(statistics.average_speed, Some(36.0));
    }

    #[test]
    fn decodes_napi_lzma_protobuf_stream() {
        // @napi-rs/lzma 1.5.1 compressSync for protobuf bytes 08 07 22 02 0a 00.
        let payload = hex_bytes("5d00008000ffffffffffffffff000401ec5e4637f346e9fffffde4d000");
        let ghost = parse_ghost(&payload).expect("NAPI LZMA V7 ghost");

        assert_eq!(ghost.version, 7);
        assert_eq!(ghost.frames.len(), 1);
        assert_eq!(ghost.frames[0].position, Vector3::default());
        assert_eq!(ghost.metadata.steam_id.as_deref(), Some("0"));
    }

    #[test]
    fn rejects_frame_and_compressed_size_limits() {
        let oversized = vec![0; MAX_GHOST_COMPRESSED_BYTES + 1];
        assert!(matches!(
            parse_ghost(&oversized),
            Err(GhostError::Limit {
                kind: "compressed bytes",
                ..
            })
        ));

        let mut payload = vec![];
        payload.extend(1_i32.to_le_bytes());
        payload.extend(((MAX_GHOST_FRAMES + 1) as i32).to_le_bytes());
        assert!(matches!(
            parse_ghost(&payload),
            Err(GhostError::Limit { kind: "frames", .. })
        ));
    }

    fn hex_bytes(value: &str) -> Vec<u8> {
        value
            .as_bytes()
            .as_chunks::<2>()
            .0
            .iter()
            .map(|pair| {
                u8::from_str_radix(std::str::from_utf8(pair).expect("hex pair"), 16)
                    .expect("hex byte")
            })
            .collect()
    }
}
