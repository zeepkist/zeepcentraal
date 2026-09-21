use hmac::{Hmac, Mac};
use rand::Rng;
use sha2::Sha256;

pub fn random_link_code() -> String {
    format!("{:08}", rand::rng().random_range(0..100_000_000_u32))
}

pub fn hash_link_value(secret: &[u8], namespace: &str, value: &str) -> anyhow::Result<String> {
    anyhow::ensure!(
        matches!(namespace, "code" | "oauth"),
        "Invalid Discord link namespace"
    );
    let mut hmac = Hmac::<Sha256>::new_from_slice(secret)?;
    hmac.update(format!("discord-link:{namespace}:{value}").as_bytes());
    Ok(hex(&hmac.finalize().into_bytes()))
}

fn hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(HEX[(byte >> 4) as usize] as char);
        output.push(HEX[(byte & 0x0f) as usize] as char);
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn link_codes_and_hmac_match_typescript_contract() -> anyhow::Result<()> {
        let code = random_link_code();
        assert_eq!(code.len(), 8);
        assert!(code.bytes().all(|byte| byte.is_ascii_digit()));
        assert_eq!(
            hash_link_value(&[b'x'; 32], "code", "12345678")?,
            "3f3e2d0cc47a49f80c6911d921621a0279c1f2ef4ca4797958cf9640f48ac8bb"
        );
        Ok(())
    }
}
