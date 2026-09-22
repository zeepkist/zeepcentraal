//! Binary KeyValue parser.
//!
//! Parses binary KV data used by Steam for package info.
//! This format is different from the text-based VDF format.

use std::{
    collections::HashMap,
    fmt,
    io::{self, BufRead, Cursor},
};

use byteorder::{LittleEndian, ReadBytesExt};

/// Error during binary KV parsing.
#[derive(Debug)]
pub enum BinaryKvError {
    /// IO error.
    Io(io::Error),
    /// Invalid type byte.
    InvalidType(u8),
    /// Invalid string encoding.
    InvalidString,
    /// Unexpected end of data.
    UnexpectedEof,
}

impl fmt::Display for BinaryKvError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            BinaryKvError::Io(e) => write!(f, "IO error: {}", e),
            BinaryKvError::InvalidType(t) => write!(f, "Invalid type byte: {}", t),
            BinaryKvError::InvalidString => write!(f, "Invalid string encoding"),
            BinaryKvError::UnexpectedEof => write!(f, "Unexpected end of data"),
        }
    }
}

impl std::error::Error for BinaryKvError {}

impl From<io::Error> for BinaryKvError {
    fn from(e: io::Error) -> Self {
        BinaryKvError::Io(e)
    }
}

/// Binary KV type markers.
#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq)]
enum BinaryKvType {
    None = 0,
    String = 1,
    Int32 = 2,
    Float32 = 3,
    Pointer = 4,
    WideString = 5,
    Color = 6,
    UInt64 = 7,
    End = 8,
    Int64 = 10,
    AlternateEnd = 11,
}

impl TryFrom<u8> for BinaryKvType {
    type Error = BinaryKvError;

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(BinaryKvType::None),
            1 => Ok(BinaryKvType::String),
            2 => Ok(BinaryKvType::Int32),
            3 => Ok(BinaryKvType::Float32),
            4 => Ok(BinaryKvType::Pointer),
            5 => Ok(BinaryKvType::WideString),
            6 => Ok(BinaryKvType::Color),
            7 => Ok(BinaryKvType::UInt64),
            8 => Ok(BinaryKvType::End),
            10 => Ok(BinaryKvType::Int64),
            11 => Ok(BinaryKvType::AlternateEnd),
            _ => Err(BinaryKvError::InvalidType(value)),
        }
    }
}

/// A binary KV value.
#[derive(Debug, Clone, PartialEq)]
pub enum BinaryKvValue {
    /// No value / null.
    None,
    /// String value.
    String(String),
    /// 32-bit integer.
    Int32(i32),
    /// 32-bit float.
    Float32(f32),
    /// Pointer (32-bit).
    Pointer(u32),
    /// Wide string (UTF-16).
    WideString(String),
    /// Color (RGBA).
    Color(u32),
    /// 64-bit unsigned integer.
    UInt64(u64),
    /// 64-bit signed integer.
    Int64(i64),
    /// Nested object.
    Object(HashMap<String, BinaryKvValue>),
}

impl BinaryKvValue {
    /// Get as string if this is a string value.
    pub fn as_str(&self) -> Option<&str> {
        match self {
            BinaryKvValue::String(s) | BinaryKvValue::WideString(s) => Some(s),
            _ => None,
        }
    }

    /// Get as i32 if this is an Int32 value.
    pub fn as_i32(&self) -> Option<i32> {
        match self {
            BinaryKvValue::Int32(v) => Some(*v),
            _ => None,
        }
    }

    /// Get as u64 if this is a UInt64 value.
    pub fn as_u64(&self) -> Option<u64> {
        match self {
            BinaryKvValue::UInt64(v) => Some(*v),
            BinaryKvValue::Int64(v) => Some(*v as u64),
            BinaryKvValue::Int32(v) => Some(*v as u64),
            _ => None,
        }
    }

    /// Get as object if this is an object value.
    pub fn as_object(&self) -> Option<&HashMap<String, BinaryKvValue>> {
        match self {
            BinaryKvValue::Object(obj) => Some(obj),
            _ => None,
        }
    }

    /// Get a nested value by key.
    pub fn get(&self, key: &str) -> Option<&BinaryKvValue> {
        self.as_object().and_then(|obj| obj.get(key))
    }

    /// Get a nested string value by key.
    pub fn get_str(&self, key: &str) -> Option<&str> {
        self.get(key).and_then(|v| v.as_str())
    }

    /// Get a nested i32 value by key.
    pub fn get_i32(&self, key: &str) -> Option<i32> {
        self.get(key).and_then(|v| v.as_i32())
    }
}

/// Binary KV parser.
struct BinaryKvParser<R> {
    reader: R,
}

impl<R: BufRead> BinaryKvParser<R> {
    fn new(reader: R) -> Self {
        Self { reader }
    }

    fn read_cstring(&mut self) -> Result<String, BinaryKvError> {
        let mut bytes = Vec::new();
        self.reader.read_until(0, &mut bytes)?;
        if bytes.last() == Some(&0) {
            bytes.pop();
        }
        String::from_utf8(bytes).map_err(|_| BinaryKvError::InvalidString)
    }

    fn read_value(&mut self, value_type: BinaryKvType) -> Result<BinaryKvValue, BinaryKvError> {
        match value_type {
            BinaryKvType::None => {
                // None type is followed by an object
                self.read_object()
            }
            BinaryKvType::String => {
                let s = self.read_cstring()?;
                Ok(BinaryKvValue::String(s))
            }
            BinaryKvType::Int32 => {
                let v = self.reader.read_i32::<LittleEndian>()?;
                Ok(BinaryKvValue::Int32(v))
            }
            BinaryKvType::Float32 => {
                let v = self.reader.read_f32::<LittleEndian>()?;
                Ok(BinaryKvValue::Float32(v))
            }
            BinaryKvType::Pointer => {
                let v = self.reader.read_u32::<LittleEndian>()?;
                Ok(BinaryKvValue::Pointer(v))
            }
            BinaryKvType::WideString => {
                // Read UTF-16 LE string
                let mut chars = Vec::new();
                loop {
                    let word = self.reader.read_u16::<LittleEndian>()?;
                    if word == 0 {
                        break;
                    }
                    chars.push(word);
                }
                let s = String::from_utf16(&chars).map_err(|_| BinaryKvError::InvalidString)?;
                Ok(BinaryKvValue::WideString(s))
            }
            BinaryKvType::Color => {
                let v = self.reader.read_u32::<LittleEndian>()?;
                Ok(BinaryKvValue::Color(v))
            }
            BinaryKvType::UInt64 => {
                let v = self.reader.read_u64::<LittleEndian>()?;
                Ok(BinaryKvValue::UInt64(v))
            }
            BinaryKvType::Int64 => {
                let v = self.reader.read_i64::<LittleEndian>()?;
                Ok(BinaryKvValue::Int64(v))
            }
            BinaryKvType::End | BinaryKvType::AlternateEnd => {
                // Should not be called with End type
                Ok(BinaryKvValue::None)
            }
        }
    }

    fn read_object(&mut self) -> Result<BinaryKvValue, BinaryKvError> {
        self.read_object_internal(true)
    }

    fn read_object_internal(&mut self, is_root: bool) -> Result<BinaryKvValue, BinaryKvError> {
        let mut map = HashMap::new();
        let mut is_first = true;

        loop {
            let type_byte = self.reader.read_u8()?;
            let value_type = BinaryKvType::try_from(type_byte)?;

            if value_type == BinaryKvType::End || value_type == BinaryKvType::AlternateEnd {
                break;
            }

            let mut key = self.read_cstring()?;

            // Root node special case: if type is None, key is empty, and this is the first
            // entry, read another cstring as the actual key (matches JS
            // behavior)
            if value_type == BinaryKvType::None && key.is_empty() && is_root && is_first {
                key = self.read_cstring()?;
            }

            is_first = false;

            let value = self.read_value_internal(value_type)?;

            // Drop empty keys (matches JS behavior)
            if !key.is_empty() {
                map.insert(key, value);
            }
        }

        Ok(BinaryKvValue::Object(map))
    }

    fn read_value_internal(&mut self, value_type: BinaryKvType) -> Result<BinaryKvValue, BinaryKvError> {
        match value_type {
            BinaryKvType::None => {
                // None type is followed by a nested object
                self.read_object_internal(false)
            }
            _ => self.read_value(value_type),
        }
    }

    fn parse(&mut self) -> Result<BinaryKvValue, BinaryKvError> {
        // Read the root object
        self.read_object()
    }
}

/// Parse binary KV data into a BinaryKvValue.
///
/// # Example
/// ```rust,ignore
/// use steam_client::binary_kv::parse_binary_kv;
///
/// let data: &[u8] = &[/* binary kv data */];
/// let value = parse_binary_kv(data).unwrap();
/// ```
pub fn parse_binary_kv(data: &[u8]) -> Result<BinaryKvValue, BinaryKvError> {
    let cursor = Cursor::new(data);
    let mut parser = BinaryKvParser::new(cursor);
    parser.parse()
}

/// Calculate the byte length of binary KV data starting at the given position.
/// This is useful for parsing multiple KV structures from a stream.
pub fn get_binary_kv_length(data: &[u8]) -> Result<usize, BinaryKvError> {
    let mut pos = 0;

    fn skip_object(data: &[u8], pos: &mut usize) -> Result<(), BinaryKvError> {
        loop {
            if *pos >= data.len() {
                return Err(BinaryKvError::UnexpectedEof);
            }

            let type_byte = data[*pos];
            *pos += 1;

            if type_byte == 8 || type_byte == 11 {
                // End or AlternateEnd
                return Ok(());
            }

            let value_type = BinaryKvType::try_from(type_byte)?;

            // Skip key string
            while *pos < data.len() && data[*pos] != 0 {
                *pos += 1;
            }
            if *pos >= data.len() {
                return Err(BinaryKvError::UnexpectedEof);
            }
            *pos += 1; // Skip null terminator

            // Skip value
            match value_type {
                BinaryKvType::None => skip_object(data, pos)?,
                BinaryKvType::String => {
                    while *pos < data.len() && data[*pos] != 0 {
                        *pos += 1;
                    }
                    if *pos >= data.len() {
                        return Err(BinaryKvError::UnexpectedEof);
                    }
                    *pos += 1;
                }
                BinaryKvType::Int32 | BinaryKvType::Float32 | BinaryKvType::Pointer | BinaryKvType::Color => {
                    if *pos + 4 > data.len() {
                        return Err(BinaryKvError::UnexpectedEof);
                    }
                    *pos += 4;
                }
                BinaryKvType::UInt64 | BinaryKvType::Int64 => {
                    if *pos + 8 > data.len() {
                        return Err(BinaryKvError::UnexpectedEof);
                    }
                    *pos += 8;
                }
                BinaryKvType::WideString => loop {
                    if *pos + 1 >= data.len() {
                        return Err(BinaryKvError::UnexpectedEof);
                    }
                    let word = u16::from_le_bytes([data[*pos], data[*pos + 1]]);
                    *pos += 2;
                    if word == 0 {
                        break;
                    }
                },
                BinaryKvType::End | BinaryKvType::AlternateEnd => return Ok(()),
            }
        }
    }

    skip_object(data, &mut pos)?;
    Ok(pos)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_object() {
        // Build a simple binary KV: { "key" : "value" }
        let mut data = Vec::new();
        data.push(1); // String type
        data.extend_from_slice(b"key\0"); // Key
        data.extend_from_slice(b"value\0"); // Value
        data.push(8); // End

        let result = parse_binary_kv(&data).unwrap();
        assert_eq!(result.get_str("key"), Some("value"));
    }

    #[test]
    fn test_int32_value() {
        // Build: { "count" : 42 }
        let mut data = Vec::new();
        data.push(2); // Int32 type
        data.extend_from_slice(b"count\0"); // Key
        data.extend_from_slice(&42i32.to_le_bytes()); // Value
        data.push(8); // End

        let result = parse_binary_kv(&data).unwrap();
        assert_eq!(result.get_i32("count"), Some(42));
    }

    #[test]
    fn test_nested_object() {
        // Build: { "parent" : { "child" : "value" } }
        let mut data = Vec::new();
        data.push(0); // None/Object type
        data.extend_from_slice(b"parent\0"); // Key
                                             // Nested object
        data.push(1); // String type
        data.extend_from_slice(b"child\0"); // Key
        data.extend_from_slice(b"value\0"); // Value
        data.push(8); // End of nested
        data.push(8); // End of root

        let result = parse_binary_kv(&data).unwrap();
        let parent = result.get("parent").unwrap();
        assert_eq!(parent.get_str("child"), Some("value"));
    }
}
