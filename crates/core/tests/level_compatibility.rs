use sha2::{Digest, Sha256};
use std::{fs, path::PathBuf};
use zc_core::levels::{LevelFormat, parse_level};

#[test]
fn matches_typescript_level_hash_vectors() {
    let fixtures =
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../packages/core/testdata/legacy-hash");
    let vectors = fs::read_to_string(fixtures.join("vectors.csv")).unwrap();
    let mut failures = Vec::new();
    for row in vectors.lines().skip(1) {
        let values: Vec<_> = row.split(',').collect();
        assert_eq!(values.len(), 5, "invalid vector: {row}");
        let bytes = fs::read(fixtures.join(values[0])).unwrap();
        assert_eq!(
            format!("{:X}", Sha256::digest(&bytes)),
            values[3],
            "{}",
            values[0]
        );
        let content = String::from_utf8(bytes).unwrap();
        let parsed = parse_level(&content, false, 0).unwrap();
        assert_eq!(
            parsed.format,
            if values[1] == "csv" {
                LevelFormat::Csv
            } else {
                LevelFormat::Json
            },
            "{}",
            values[0]
        );
        if parsed.zeep_hash != values[2] || parsed.hash != values[4] {
            failures.push(format!(
                "{} legacy={} expected={} xxh128={} expected={}",
                values[0], parsed.zeep_hash, values[2], parsed.hash, values[4]
            ));
        }
    }
    assert!(failures.is_empty(), "{}", failures.join("\n"));
}

#[test]
fn parses_bom_non_finite_and_adventure_contracts() {
    let json = "\u{feff}{\"level\":{\"UID\":\"uid-json\",\"zeepHash\":\"old\"},\"author\":{\"name\":\"A\",\"StmID\":\"76561198000000000\"},\"medals\":{\"author\":NaN},\"enviro\":{\"skybox\":2,\"groundMat\":-1},\"blox\":[{\"i\":1609,\"d\":{\"n\":{\"ch5\":1}}},{\"i\":1616}]}";
    let parsed = parse_level(json, true, 0).unwrap();
    assert_eq!(parsed.zeep_hash, "uid-json");
    assert_eq!(parsed.author_id, 76_561_198_000_000_000);
    assert_eq!(parsed.validation_time_author, 0.0);
    assert_eq!(parsed.amount_checkpoints, 1);
    assert_eq!(parsed.amount_finishes, 1);
}
