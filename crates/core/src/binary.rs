//! Little-endian, least-significant-bit-first Zeepnet/Lidgren primitives.
//! Port of packages/core/src/zeepnet/binary.ts.
use anyhow::{Result, bail, ensure};

pub struct BitReader<'a> {
    data: &'a [u8],
    position: usize,
}
impl<'a> BitReader<'a> {
    pub fn new(data: &'a [u8]) -> Self {
        Self { data, position: 0 }
    }
    pub fn remaining_bits(&self) -> usize {
        self.data.len() * 8 - self.position
    }
    fn bits(&mut self, count: usize) -> Result<u64> {
        ensure!(
            (1..=64).contains(&count) && count <= self.remaining_bits(),
            "Packet ended before requested bits"
        );
        let mut result = 0u64;
        for bit in 0..count {
            let position = self.position + bit;
            result |= u64::from((self.data[position / 8] >> (position % 8)) & 1) << bit;
        }
        self.position += count;
        Ok(result)
    }
    pub fn boolean(&mut self) -> Result<bool> {
        Ok(self.bits(1)? != 0)
    }
    pub fn byte(&mut self) -> Result<u8> {
        Ok(self.bits(8)? as u8)
    }
    pub fn uint16(&mut self) -> Result<u16> {
        Ok(self.bits(16)? as u16)
    }
    pub fn uint32(&mut self) -> Result<u32> {
        Ok(self.bits(32)? as u32)
    }
    pub fn int32(&mut self) -> Result<i32> {
        Ok(self.uint32()? as i32)
    }
    pub fn uint64(&mut self) -> Result<u64> {
        self.bits(64)
    }
    pub fn int64(&mut self) -> Result<i64> {
        Ok(self.uint64()? as i64)
    }
    pub fn float32(&mut self) -> Result<f32> {
        Ok(f32::from_bits(self.uint32()?))
    }
    pub fn float64(&mut self) -> Result<f64> {
        Ok(f64::from_bits(self.uint64()?))
    }
    pub fn variable_uint32(&mut self) -> Result<u32> {
        let mut result = 0;
        for index in 0..5 {
            let byte = self.byte()?;
            ensure!(
                index != 4 || byte & 0xf0 == 0,
                "Variable UInt32 exceeds 32 bits"
            );
            result |= u32::from(byte & 0x7f) << (index * 7);
            if byte & 0x80 == 0 {
                return Ok(result);
            }
        }
        bail!("Variable UInt32 exceeds five bytes")
    }
    pub fn bytes(&mut self, length: usize) -> Result<Vec<u8>> {
        ensure!(
            length <= self.remaining_bits() / 8,
            "Packet ended before requested bytes"
        );
        if self.position.is_multiple_of(8) {
            let start = self.position / 8;
            self.position += length * 8;
            return Ok(self.data[start..start + length].to_vec());
        }
        (0..length).map(|_| self.byte()).collect()
    }
    pub fn string(&mut self, max_bytes: usize) -> Result<String> {
        let length = self.variable_uint32()? as usize;
        ensure!(length <= max_bytes, "String exceeds {max_bytes} bytes");
        Ok(String::from_utf8(self.bytes(length)?)?)
    }
}

#[derive(Default)]
pub struct BitWriter {
    data: Vec<u8>,
    position: usize,
}
impl BitWriter {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn bit_length(&self) -> usize {
        self.position
    }
    pub fn as_bytes(&self) -> &[u8] {
        &self.data
    }
    fn bits(&mut self, value: u64, count: usize) {
        let size = (self.position + count).div_ceil(8);
        self.data.resize(size, 0);
        for bit in 0..count {
            let position = self.position + bit;
            self.data[position / 8] |= (((value >> bit) & 1) as u8) << (position % 8);
        }
        self.position += count;
    }
    pub fn boolean(&mut self, value: bool) {
        self.bits(u64::from(value), 1);
    }
    pub fn byte(&mut self, value: u8) {
        self.bits(u64::from(value), 8);
    }
    pub fn uint16(&mut self, value: u16) {
        self.bits(u64::from(value), 16);
    }
    pub fn uint32(&mut self, value: u32) {
        self.bits(u64::from(value), 32);
    }
    pub fn int32(&mut self, value: i32) {
        self.uint32(value as u32);
    }
    pub fn uint64(&mut self, value: u64) {
        self.bits(value, 64);
    }
    pub fn int64(&mut self, value: i64) {
        self.uint64(value as u64);
    }
    pub fn float32(&mut self, value: f32) {
        self.uint32(value.to_bits());
    }
    pub fn float64(&mut self, value: f64) {
        self.uint64(value.to_bits());
    }
    pub fn variable_uint32(&mut self, mut value: u32) {
        loop {
            let mut byte = (value & 0x7f) as u8;
            value >>= 7;
            if value != 0 {
                byte |= 0x80;
            }
            self.byte(byte);
            if value == 0 {
                break;
            }
        }
    }
    pub fn bytes(&mut self, value: &[u8]) {
        for &byte in value {
            self.byte(byte);
        }
    }
    pub fn string(&mut self, value: &str) -> Result<()> {
        self.variable_uint32(value.len().try_into()?);
        self.bytes(value.as_bytes());
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_truncated_overflow_and_invalid_utf8() {
        assert!(BitReader::new(&[0xff; 5]).variable_uint32().is_err());
        assert!(BitReader::new(&[0x80]).variable_uint32().is_err());
        assert!(BitReader::new(&[1, 0xff]).string(4096).is_err());
        assert!(BitReader::new(&[2, b'a', b'b']).string(1).is_err());
        assert!(BitReader::new(&[0]).bytes(usize::MAX).is_err());
    }
    #[test]
    fn matches_typescript_golden_vectors() -> Result<()> {
        let fixtures: serde_json::Value =
            serde_json::from_str(include_str!("../fixtures/binary.json"))?;
        for fixture in fixtures.as_array().unwrap() {
            let aligned = fixture["aligned"].as_bool().unwrap();
            let data: Vec<u8> = serde_json::from_value(fixture["bytes"].clone())?;
            let mut reader = BitReader::new(&data);
            if !aligned {
                assert!(reader.boolean()?);
            }
            assert_eq!(reader.uint16()?, 65535);
            assert_eq!(reader.int32()?, -2147483648);
            assert_eq!(reader.uint32()?, 4294967295);
            assert_eq!(reader.uint64()?, u64::MAX);
            assert_eq!(reader.int64()?, i64::MIN);
            assert_eq!(reader.float32()?, 1.25);
            assert_eq!(reader.float64()?, -123.125);
            assert_eq!(reader.variable_uint32()?, u32::MAX);
            assert_eq!(reader.string(4096)?, "Zeep 🚗");
            let mut writer = BitWriter::new();
            if !aligned {
                writer.boolean(true);
            }
            writer.uint16(u16::MAX);
            writer.int32(i32::MIN);
            writer.uint32(u32::MAX);
            writer.uint64(u64::MAX);
            writer.int64(i64::MIN);
            writer.float32(1.25);
            writer.float64(-123.125);
            writer.variable_uint32(u32::MAX);
            writer.string("Zeep 🚗")?;
            assert_eq!(writer.as_bytes(), data);
            assert_eq!(
                writer.bit_length(),
                fixture["bits"].as_u64().unwrap() as usize
            );
        }
        Ok(())
    }
}
