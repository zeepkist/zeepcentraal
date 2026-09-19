use std::collections::HashMap;

pub const ACCESS_TOKEN: &str = "zeepcentral_access_token";
pub const REFRESH_TOKEN: &str = "zeepcentral_refresh_token";
pub const STEAM_ID: &str = "zeepcentral_steam_id";
pub const OAUTH_STATE: &str = "zeepcentral_oauth_state";

pub fn parse_cookie_header(header: Option<&str>) -> HashMap<String, String> {
    header
        .unwrap_or_default()
        .split(';')
        .filter_map(|item| {
            let (key, value) = item.trim().split_once('=')?;
            if key.is_empty() {
                return None;
            }
            percent_decode(value).map(|value| (key.to_owned(), value))
        })
        .collect()
}

pub fn get_cookie(header: Option<&str>, name: &str) -> Option<String> {
    parse_cookie_header(header).remove(name)
}

fn percent_decode(value: &str) -> Option<String> {
    let bytes = value.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            let hex = bytes.get(index + 1..index + 3)?;
            let text = std::str::from_utf8(hex).ok()?;
            decoded.push(u8::from_str_radix(text, 16).ok()?);
            index += 3;
        } else {
            decoded.push(bytes[index]);
            index += 1;
        }
    }
    String::from_utf8(decoded).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preserves_embedded_equals_and_ignores_malformed_values() {
        let values = parse_cookie_header(Some("one=a%20b; token=a=b=c; bad=%ZZ"));
        assert_eq!(values.get("one").map(String::as_str), Some("a b"));
        assert_eq!(values.get("token").map(String::as_str), Some("a=b=c"));
        assert!(!values.contains_key("bad"));
    }
}
