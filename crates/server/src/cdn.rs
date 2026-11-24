use serde_json::Value;
use url::Url;

pub(crate) fn resolve_image_url(value: &mut String, base: Option<&Url>) {
    let Some(base) = base.filter(|_| !value.trim().is_empty()) else {
        return;
    };
    match base.join(value) {
        Ok(url) => *value = url.into(),
        Err(error) => tracing::warn!(%error, "CDN image URL conversion failed"),
    }
}

pub(crate) fn resolve_image_urls(value: &mut Value, base: &Url) {
    match value {
        Value::Array(items) => {
            for item in items {
                resolve_image_urls(item, base);
            }
        }
        Value::Object(fields) => {
            for (key, value) in fields {
                if key == "imageUrl" {
                    if let Value::String(url) = value {
                        resolve_image_url(url, Some(base));
                    }
                } else {
                    resolve_image_urls(value, base);
                }
            }
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn resolves_playlist_images_against_the_configured_base() {
        let base = Url::parse("https://cdn.example.test/assets/").unwrap();
        let mut status = json!({
            "playlists": [{
                "levels": [{"imageUrl": "/thumbnails/01M824XTHT9CPQVVDBYFG3SE8M.jpg"}],
                "verifiedLevels": [{"imageUrl": "thumbnails/track two.jpg"}],
                "pendingCandidates": [{"imageUrl": "https://steam.example.test/preview.jpg"}],
                "rejectedCandidates": [
                    {"imageUrl": null},
                    {},
                    {"imageUrl": ""},
                    {"imageUrl": "https://[invalid]"},
                    {"playlistUrl": "/list.zeeplist"}
                ]
            }]
        });
        resolve_image_urls(&mut status, &base);
        assert_eq!(
            status,
            json!({
                "playlists": [{
                    "levels": [{"imageUrl": "https://cdn.example.test/thumbnails/01M824XTHT9CPQVVDBYFG3SE8M.jpg"}],
                    "verifiedLevels": [{"imageUrl": "https://cdn.example.test/assets/thumbnails/track%20two.jpg"}],
                    "pendingCandidates": [{"imageUrl": "https://steam.example.test/preview.jpg"}],
                    "rejectedCandidates": [
                        {"imageUrl": null},
                        {},
                        {"imageUrl": ""},
                        {"imageUrl": "https://[invalid]"},
                        {"playlistUrl": "/list.zeeplist"}
                    ]
                }]
            })
        );
    }
}
