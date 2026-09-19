use anyhow::{Result, bail, ensure};

const MAX_VAR_UINT_BYTES: usize = 5;

pub struct BitReader<'a> {
    data: &'a [u8],
    bit_position: usize,
}

impl<'a> BitReader<'a> {
    pub const fn new(data: &'a [u8]) -> Self {
        Self {
            data,
            bit_position: 0,
        }
    }

    pub fn remaining_bits(&self) -> usize {
        self.data.len() * 8 - self.bit_position
    }

    pub fn read_bool(&mut self) -> Result<bool> {
        Ok(self.read_bits(1)? == 1)
    }

    pub fn read_u8(&mut self) -> Result<u8> {
        Ok(self.read_bits(8)? as u8)
    }

    pub fn read_u16(&mut self) -> Result<u16> {
        Ok(self.read_bits(16)? as u16)
    }

    pub fn read_i32(&mut self) -> Result<i32> {
        Ok(self.read_bits(32)? as i32)
    }

    pub fn read_u32(&mut self) -> Result<u32> {
        self.read_bits(32)
    }

    pub fn read_u64(&mut self) -> Result<u64> {
        let mut value = 0_u64;
        for bit in 0..64 {
            value |= u64::from(self.read_bits(1)?) << bit;
        }
        Ok(value)
    }

    pub fn read_f32(&mut self) -> Result<f32> {
        let mut bytes = [0_u8; 4];
        bytes.copy_from_slice(&self.read_bytes(4)?);
        Ok(f32::from_le_bytes(bytes))
    }

    pub fn read_f64(&mut self) -> Result<f64> {
        let mut bytes = [0_u8; 8];
        bytes.copy_from_slice(&self.read_bytes(8)?);
        Ok(f64::from_le_bytes(bytes))
    }

    pub fn read_variable_u32(&mut self) -> Result<u32> {
        let mut value = 0_u32;
        for index in 0..MAX_VAR_UINT_BYTES {
            let byte = self.read_u8()?;
            if index == MAX_VAR_UINT_BYTES - 1 && byte & 0xf0 != 0 {
                bail!("Variable UInt32 exceeds 32 bits");
            }
            value |= u32::from(byte & 0x7f) << (index * 7);
            if byte & 0x80 == 0 {
                return Ok(value);
            }
        }
        bail!("Variable UInt32 exceeds five bytes")
    }

    pub fn read_string(&mut self, maximum_bytes: usize) -> Result<String> {
        let length = usize::try_from(self.read_variable_u32()?)?;
        ensure!(
            length <= maximum_bytes,
            "String exceeds {maximum_bytes} bytes"
        );
        Ok(String::from_utf8(self.read_bytes(length)?)?)
    }

    pub fn read_bytes(&mut self, length: usize) -> Result<Vec<u8>> {
        ensure!(
            length
                .checked_mul(8)
                .is_some_and(|bits| bits <= self.remaining_bits()),
            "Packet ended before requested bytes"
        );
        if self.bit_position & 7 == 0 {
            let offset = self.bit_position >> 3;
            self.bit_position += length * 8;
            return Ok(self.data[offset..offset + length].to_vec());
        }
        (0..length).map(|_| self.read_u8()).collect()
    }

    fn read_bits(&mut self, count: usize) -> Result<u32> {
        ensure!(
            (1..=32).contains(&count) && count <= self.remaining_bits(),
            "Packet ended before requested bits"
        );
        let mut value = 0_u32;
        for bit in 0..count {
            let source = self.bit_position + bit;
            value |= u32::from((self.data[source >> 3] >> (source & 7)) & 1) << bit;
        }
        self.bit_position += count;
        Ok(value)
    }
}

#[derive(Default)]
pub struct BitWriter {
    bytes: Vec<u8>,
    bit_position: usize,
}

impl BitWriter {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn bit_length(&self) -> usize {
        self.bit_position
    }

    pub fn write_bool(&mut self, value: bool) {
        self.write_bits(u32::from(value), 1);
    }

    pub fn write_u8(&mut self, value: u8) {
        self.write_bits(u32::from(value), 8);
    }

    pub fn write_u16(&mut self, value: u16) {
        self.write_bits(u32::from(value), 16);
    }

    pub fn write_i32(&mut self, value: i32) {
        self.write_bits(value as u32, 32);
    }

    pub fn write_u32(&mut self, value: u32) {
        self.write_bits(value, 32);
    }

    pub fn write_u64(&mut self, value: u64) {
        for bit in 0..64 {
            self.write_bits(((value >> bit) & 1) as u32, 1);
        }
    }

    pub fn write_f32(&mut self, value: f32) {
        self.write_bytes(&value.to_le_bytes());
    }

    pub fn write_f64(&mut self, value: f64) {
        self.write_bytes(&value.to_le_bytes());
    }

    pub fn write_variable_u32(&mut self, value: u32) {
        let mut remaining = value;
        loop {
            let mut byte = (remaining & 0x7f) as u8;
            remaining >>= 7;
            if remaining != 0 {
                byte |= 0x80;
            }
            self.write_u8(byte);
            if remaining == 0 {
                break;
            }
        }
    }

    pub fn write_string(&mut self, value: &str) -> Result<()> {
        let bytes = value.as_bytes();
        self.write_variable_u32(u32::try_from(bytes.len())?);
        self.write_bytes(bytes);
        Ok(())
    }

    pub fn write_bytes(&mut self, bytes: &[u8]) {
        if self.bit_position & 7 == 0 {
            let offset = self.bit_position >> 3;
            self.bytes.resize(offset + bytes.len(), 0);
            self.bytes[offset..].copy_from_slice(bytes);
            self.bit_position += bytes.len() * 8;
            return;
        }
        for byte in bytes {
            self.write_u8(*byte);
        }
    }

    pub fn into_bytes(mut self) -> Vec<u8> {
        self.bytes.truncate(self.bit_position.div_ceil(8));
        self.bytes
    }

    fn write_bits(&mut self, value: u32, count: usize) {
        self.bytes
            .resize((self.bit_position + count).div_ceil(8), 0);
        for bit in 0..count {
            let target = self.bit_position + bit;
            self.bytes[target >> 3] |= (((value >> bit) & 1) as u8) << (target & 7);
        }
        self.bit_position += count;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_unaligned_values_and_unicode() -> Result<()> {
        let mut writer = BitWriter::new();
        writer.write_bool(true);
        writer.write_i32(-42);
        writer.write_u64(u64::MAX - 1);
        writer.write_f64(300.5);
        writer.write_string("Café 雪")?;
        let bits = writer.bit_length();
        let bytes = writer.into_bytes();

        let mut reader = BitReader::new(&bytes);
        assert!(reader.read_bool()?);
        assert_eq!(reader.read_i32()?, -42);
        assert_eq!(reader.read_u64()?, u64::MAX - 1);
        assert_eq!(reader.read_f64()?, 300.5);
        assert_eq!(reader.read_string(100)?, "Café 雪");
        assert_eq!(reader.remaining_bits(), bytes.len() * 8 - bits);
        Ok(())
    }
}
