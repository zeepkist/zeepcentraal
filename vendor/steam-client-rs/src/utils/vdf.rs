//! VDF (Valve Data Format) parser.
//!
//! Parses text-based VDF/KeyValue data used by Steam for app info.
//! This is a simple recursive descent parser for the VDF format.

use std::{collections::HashMap, fmt};

/// Error during VDF parsing.
#[derive(Debug)]
pub enum VdfError {
    /// Unexpected end of input.
    UnexpectedEof,
    /// Expected a specific character.
    Expected(char),
    /// Invalid escape sequence.
    InvalidEscape(char),
    /// Generic parse error.
    ParseError(String),
}

impl fmt::Display for VdfError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            VdfError::UnexpectedEof => write!(f, "Unexpected end of input"),
            VdfError::Expected(c) => write!(f, "Expected '{}'", c),
            VdfError::InvalidEscape(c) => write!(f, "Invalid escape sequence: \\{}", c),
            VdfError::ParseError(msg) => write!(f, "Parse error: {}", msg),
        }
    }
}

impl std::error::Error for VdfError {}

/// A VDF value - either a string or an object (nested key-value pairs).
#[derive(Debug, Clone, PartialEq)]
pub enum VdfValue {
    /// A string value.
    String(String),
    /// An object containing nested key-value pairs.
    Object(HashMap<String, VdfValue>),
    /// A list of values (when a key is duplicated).
    Array(Vec<VdfValue>),
}

impl VdfValue {
    /// Get as string if this is a string value.
    pub fn as_str(&self) -> Option<&str> {
        match self {
            VdfValue::String(s) => Some(s),
            _ => None,
        }
    }

    /// Get as object if this is an object value.
    pub fn as_object(&self) -> Option<&HashMap<String, VdfValue>> {
        match self {
            VdfValue::Object(obj) => Some(obj),
            _ => None,
        }
    }

    /// Get as array if this is an array value.
    pub fn as_array(&self) -> Option<&Vec<VdfValue>> {
        match self {
            VdfValue::Array(arr) => Some(arr),
            _ => None,
        }
    }

    /// Get a nested value by key.
    pub fn get(&self, key: &str) -> Option<&VdfValue> {
        self.as_object().and_then(|obj| obj.get(key))
    }

    /// Get a nested string value by key.
    pub fn get_str(&self, key: &str) -> Option<&str> {
        self.get(key).and_then(|v| v.as_str())
    }
}

/// VDF parser state.
struct VdfParser<'a> {
    input: &'a str,
    pos: usize,
}

impl<'a> VdfParser<'a> {
    fn new(input: &'a str) -> Self {
        Self { input, pos: 0 }
    }

    fn peek(&self) -> Option<char> {
        self.input[self.pos..].chars().next()
    }

    fn advance(&mut self) -> Option<char> {
        if let Some(c) = self.peek() {
            self.pos += c.len_utf8();
            Some(c)
        } else {
            None
        }
    }

    fn skip_whitespace(&mut self) {
        while let Some(c) = self.peek() {
            if c.is_whitespace() {
                self.advance();
            } else if c == '/' {
                // Check for comment
                let next_pos = self.pos + 1;
                if next_pos < self.input.len() {
                    let next_char = self.input[next_pos..].chars().next();
                    if next_char == Some('/') {
                        // Line comment - skip to end of line
                        while let Some(c) = self.peek() {
                            self.advance();
                            if c == '\n' {
                                break;
                            }
                        }
                    } else {
                        break;
                    }
                } else {
                    break;
                }
            } else {
                break;
            }
        }
    }

    fn skip_conditionals(&mut self) {
        self.skip_whitespace();
        while self.peek() == Some('[') {
            while let Some(c) = self.advance() {
                if c == ']' {
                    break;
                }
            }
            self.skip_whitespace();
        }
    }

    fn parse_string(&mut self) -> Result<String, VdfError> {
        self.skip_whitespace();

        let quoted = self.peek() == Some('"');
        if quoted {
            self.advance(); // consume opening quote
        }

        let mut result = String::new();

        loop {
            match self.peek() {
                None => {
                    if quoted {
                        return Err(VdfError::UnexpectedEof);
                    }
                    break;
                }
                Some('"') if quoted => {
                    self.advance(); // consume closing quote
                    break;
                }
                Some(c) if !quoted && (c.is_whitespace() || c == '{' || c == '}') => {
                    break;
                }
                Some('\\') => {
                    self.advance();
                    match self.advance() {
                        Some('n') => result.push('\n'),
                        Some('t') => result.push('\t'),
                        Some('\\') => result.push('\\'),
                        Some('"') => result.push('"'),
                        Some(c) => return Err(VdfError::InvalidEscape(c)),
                        None => return Err(VdfError::UnexpectedEof),
                    }
                }
                Some(c) => {
                    self.advance();
                    result.push(c);
                }
            }
        }

        Ok(result)
    }

    fn parse_value(&mut self) -> Result<VdfValue, VdfError> {
        self.skip_whitespace();

        if self.peek() == Some('{') {
            self.parse_object()
        } else {
            Ok(VdfValue::String(self.parse_string()?))
        }
    }

    fn insert_or_append(map: &mut HashMap<String, VdfValue>, key: String, value: VdfValue) {
        if let Some(existing) = map.get_mut(&key) {
            match existing {
                VdfValue::Array(arr) => arr.push(value),
                _ => {
                    let old = existing.clone();
                    *existing = VdfValue::Array(vec![old, value]);
                }
            }
        } else {
            map.insert(key, value);
        }
    }

    fn parse_object(&mut self) -> Result<VdfValue, VdfError> {
        self.skip_whitespace();

        if self.peek() != Some('{') {
            return Err(VdfError::Expected('{'));
        }
        self.advance(); // consume '{'

        let mut map = HashMap::new();

        loop {
            self.skip_whitespace();

            match self.peek() {
                None => return Err(VdfError::UnexpectedEof),
                Some('}') => {
                    self.advance(); // consume '}'
                    break;
                }
                _ => {
                    let key = self.parse_string()?;
                    let value = self.parse_value()?;
                    self.skip_conditionals();
                    Self::insert_or_append(&mut map, key, value);
                }
            }
        }

        Ok(VdfValue::Object(map))
    }

    fn parse_root(&mut self) -> Result<VdfValue, VdfError> {
        self.skip_whitespace();

        // Root can be either a single object or key-value pairs
        if self.peek() == Some('{') {
            self.parse_object()
        } else {
            // Parse as key-value pairs at root level
            let mut map = HashMap::new();

            loop {
                self.skip_whitespace();

                if self.peek().is_none() {
                    break;
                }

                let key = self.parse_string()?;
                let value = self.parse_value()?;
                self.skip_conditionals();
                Self::insert_or_append(&mut map, key, value);
            }

            Ok(VdfValue::Object(map))
        }
    }
}

/// Parse a VDF string into a VdfValue.
///
/// # Example
/// ```rust
/// use steam_client::utils::vdf::parse_vdf;
///
/// let vdf = r#"
/// "appinfo"
/// {
///     "appid" "730"
///     "name" "Counter-Strike 2"
/// }
/// "#;
///
/// let value = parse_vdf(vdf).expect("should not fail");
/// ```
pub fn parse_vdf(input: &str) -> Result<VdfValue, VdfError> {
    let mut parser = VdfParser::new(input);
    parser.parse_root()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_object() {
        let vdf = r#"
        "appinfo"
        {
            "appid" "730"
            "name" "Counter-Strike 2"
        }
        "#;

        let result = parse_vdf(vdf).expect("should not fail");
        let appinfo = result.get("appinfo").expect("should not fail");
        assert_eq!(appinfo.get_str("appid"), Some("730"));
        assert_eq!(appinfo.get_str("name"), Some("Counter-Strike 2"));
    }

    #[test]
    fn test_nested_object() {
        let vdf = r#"
        "appinfo"
        {
            "common"
            {
                "name" "Test Game"
                "type" "Game"
            }
        }
        "#;

        let result = parse_vdf(vdf).expect("should not fail");
        let common = result.get("appinfo").expect("should not fail").get("common").expect("should not fail");
        assert_eq!(common.get_str("name"), Some("Test Game"));
        assert_eq!(common.get_str("type"), Some("Game"));
    }

    #[test]
    fn test_escape_sequences() {
        let vdf = r#""key" "value with \"quotes\" and \\backslash""#;
        let result = parse_vdf(vdf).expect("should not fail");
        assert_eq!(result.get_str("key"), Some("value with \"quotes\" and \\backslash"));
    }

    #[test]
    fn test_comments() {
        let vdf = r#"
        // This is a comment
        "key" "value"
        "#;
        let result = parse_vdf(vdf).expect("should not fail");
        assert_eq!(result.get_str("key"), Some("value"));
    }
}
