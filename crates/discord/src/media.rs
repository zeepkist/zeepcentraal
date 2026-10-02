/// Image fields hold storage keys or direct URLs; Discord needs absolute URLs.
pub(crate) fn thumbnail_url(value: &str) -> Option<String> {
    let value = value.trim();
    let url = reqwest::Url::parse(value).ok().or_else(|| {
        let key = value.trim_start_matches('/');
        if !key.contains('/') || value.starts_with("//") || value.contains(':') {
            return None;
        }
        let mut url = reqwest::Url::parse("https://cdn.zeepki.st/").ok()?;
        url.set_path(key);
        Some(url)
    })?;
    (matches!(url.scheme(), "http" | "https") && url.has_host()).then(|| url.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_storage_keys_and_normalizes_direct_urls() {
        for (value, expected) in [
            (
                "thumbnails/track.jpg",
                "https://cdn.zeepki.st/thumbnails/track.jpg",
            ),
            (
                " /thumbnails/track.jpg ",
                "https://cdn.zeepki.st/thumbnails/track.jpg",
            ),
            (
                "thumbnails-dev/track.jpg",
                "https://cdn.zeepki.st/thumbnails-dev/track.jpg",
            ),
            ("assets/track.jpg", "https://cdn.zeepki.st/assets/track.jpg"),
            (
                "thumbnails/track #1.jpg",
                "https://cdn.zeepki.st/thumbnails/track%20%231.jpg",
            ),
            (
                " https://example.com/track.jpg ",
                "https://example.com/track.jpg",
            ),
            (
                "https://example.com/track 1.jpg",
                "https://example.com/track%201.jpg",
            ),
            (
                "http://example.com/track.jpg",
                "http://example.com/track.jpg",
            ),
        ] {
            assert_eq!(thumbnail_url(value).as_deref(), Some(expected), "{value}");
        }
    }

    #[test]
    fn rejects_missing_malformed_and_unsupported_urls() {
        for value in [
            "",
            "  ",
            "not a URL",
            "https://[invalid]/track.jpg",
            "https://example.com:invalid/track.jpg",
            "//example.com/track.jpg",
            "file:///track.jpg",
            "ftp://example.com/track.jpg",
            "data:image/png;base64,AAAA",
        ] {
            assert_eq!(thumbnail_url(value), None, "{value}");
        }
    }
}
