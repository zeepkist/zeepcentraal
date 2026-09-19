use anyhow::{Result, ensure};

pub const LIDGREN_HEADER_BYTES: usize = 5;

pub fn validate_udp_payload(payload: &[u8], maximum: usize) -> Result<()> {
    ensure!(
        payload.len() >= LIDGREN_HEADER_BYTES,
        "Lidgren packet is truncated"
    );
    ensure!(
        payload.len() <= maximum,
        "Lidgren packet exceeds configured maximum"
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    #[test]
    fn rejects_truncated_packets() {
        assert!(super::validate_udp_payload(&[0; 4], 1024).is_err());
        assert!(super::validate_udp_payload(&[0; 5], 1024).is_ok());
    }
}
