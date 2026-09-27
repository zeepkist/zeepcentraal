use anyhow::{Result, ensure};
use flate2::{Compression, GzBuilder};
use std::{collections::HashSet, io::Write};

pub struct ArchiveLevel {
    pub workshop_id: u64,
    pub name: String,
    pub level: Vec<u8>,
    pub index: Option<Vec<u8>>,
    pub thumbnail: Option<Vec<u8>>,
}

pub fn normalized_stem(name: &str) -> Result<String> {
    let trimmed = name.trim();
    let lower = trimmed.to_ascii_lowercase();
    let rest = if lower.starts_with("zsl -") {
        &trimmed[5..]
    } else if lower.starts_with("zsl-") {
        &trimmed[4..]
    } else {
        trimmed
    };
    let safe = rest
        .chars()
        .map(|ch| {
            if ch.is_control() || matches!(ch, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|')
            {
                '-'
            } else {
                ch
            }
        })
        .collect::<String>();
    let safe = safe.trim().trim_end_matches('.').trim();
    Ok(format!(
        "ZSL - {}",
        if safe.is_empty() { "Untitled" } else { safe }
    ))
}

pub fn build_archive(levels: &[ArchiveLevel]) -> Result<Vec<u8>> {
    let mut names = HashSet::new();
    let mut entries = Vec::new();
    for level in levels {
        let mut stem = normalized_stem(&level.name)?;
        if !names.insert(stem.to_lowercase()) {
            stem = format!("{stem} - {}", level.workshop_id);
            ensure!(
                names.insert(stem.to_lowercase()),
                "Duplicate archive level name"
            );
        }
        entries.push((format!("{stem}/{stem}.zeeplevel"), &level.level));
        if let Some(index) = &level.index {
            entries.push((format!("{stem}/indexdata.zeepindex"), index));
        }
        if let Some(thumbnail) = &level.thumbnail {
            entries.push((format!("{stem}/{stem}_Thumbnail.jpg"), thumbnail));
        }
    }
    let mut gzip = GzBuilder::new()
        .mtime(0)
        .write(Vec::new(), Compression::default());
    for (path, bytes) in entries {
        let needs_pax = path.len() > 100 || !path.is_ascii();
        if needs_pax {
            let pax = pax_path(&path);
            write_entry(&mut gzip, "PaxHeader", &pax, b'x')?;
        }
        write_entry(
            &mut gzip,
            if needs_pax { "file" } else { &path },
            bytes,
            b'0',
        )?;
    }
    gzip.write_all(&[0; 1024])?;
    Ok(gzip.finish()?)
}

fn pax_path(path: &str) -> Vec<u8> {
    let body = format!("path={path}\n");
    let mut size = body.len() + 2;
    loop {
        let actual = size.to_string().len() + 1 + body.len();
        if actual == size {
            return format!("{size} {body}").into_bytes();
        }
        size = actual;
    }
}

fn write_entry(writer: &mut impl Write, name: &str, bytes: &[u8], kind: u8) -> Result<()> {
    ensure!(
        name.len() <= 100 && name.is_ascii(),
        "Tar header name exceeds 100 ASCII bytes"
    );
    let mut header = [0u8; 512];
    header[..name.len()].copy_from_slice(name.as_bytes());
    octal(&mut header[100..108], 0o644);
    octal(&mut header[108..116], 0);
    octal(&mut header[116..124], 0);
    octal(&mut header[124..136], bytes.len() as u64);
    octal(&mut header[136..148], 0);
    header[148..156].fill(b' ');
    header[156] = kind;
    header[257..263].copy_from_slice(b"ustar\0");
    header[263..265].copy_from_slice(b"00");
    let checksum: u64 = header.iter().map(|byte| u64::from(*byte)).sum();
    header[148..156].copy_from_slice(format!("{checksum:06o}\0 ").as_bytes());
    writer.write_all(&header)?;
    writer.write_all(bytes)?;
    let padding = (512 - bytes.len() % 512) % 512;
    writer.write_all(&[0; 512][..padding])?;
    Ok(())
}

fn octal(field: &mut [u8], value: u64) {
    field.copy_from_slice(format!("{:0width$o}\0", value, width = field.len() - 1).as_bytes());
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_normalize_without_touching_bytes() {
        assert_eq!(normalized_stem("zsl - my level").unwrap(), "ZSL - my level");
        assert_eq!(normalized_stem("zsl-my level").unwrap(), "ZSL - my level");
        assert_eq!(normalized_stem("Altitude").unwrap(), "ZSL - Altitude");
        assert_eq!(normalized_stem("../bad").unwrap(), "ZSL - ..-bad");
        assert_eq!(
            normalized_stem("zsl- Bad:Name?.").unwrap(),
            "ZSL - Bad-Name-"
        );
        assert_eq!(normalized_stem("zsl-").unwrap(), "ZSL - Untitled");
    }

    #[test]
    fn archive_uses_matching_stems_and_collision_suffix() {
        let levels = [
            ArchiveLevel {
                workshop_id: 1,
                name: "Altitude".into(),
                level: b"raw".to_vec(),
                index: Some(b"index".to_vec()),
                thumbnail: Some(b"jpg".to_vec()),
            },
            ArchiveLevel {
                workshop_id: 2,
                name: "zsl-altitude".into(),
                level: b"next".to_vec(),
                index: None,
                thumbnail: None,
            },
        ];
        let bytes = build_archive(&levels).unwrap();
        let mut decoder = flate2::read::GzDecoder::new(bytes.as_slice());
        let mut tar = Vec::new();
        std::io::Read::read_to_end(&mut decoder, &mut tar).unwrap();
        let mut entries = std::collections::HashMap::new();
        let mut position = 0;
        while tar[position..position + 512].iter().any(|byte| *byte != 0) {
            let header = &tar[position..position + 512];
            let name = std::str::from_utf8(&header[..100])
                .unwrap()
                .trim_end_matches('\0');
            let size = std::str::from_utf8(&header[124..136])
                .unwrap()
                .trim_end_matches('\0');
            let size = usize::from_str_radix(size, 8).unwrap();
            position += 512;
            entries.insert(name.to_owned(), &tar[position..position + size]);
            position += size.div_ceil(512) * 512;
        }
        assert_eq!(entries["ZSL - Altitude/ZSL - Altitude.zeeplevel"], b"raw");
        assert_eq!(entries["ZSL - Altitude/indexdata.zeepindex"], b"index");
        assert_eq!(
            entries["ZSL - Altitude/ZSL - Altitude_Thumbnail.jpg"],
            b"jpg"
        );
        assert_eq!(
            entries["ZSL - altitude - 2/ZSL - altitude - 2.zeeplevel"],
            b"next"
        );
    }
}
