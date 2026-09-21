use ulid::Ulid;
use xxhash_rust::xxh3::xxh3_128;

pub fn generate_uid() -> String {
    Ulid::new().to_string()
}

pub fn xxh128_hex(content: impl AsRef<[u8]>) -> String {
    format!("{:032X}", xxh3_128(content.as_ref()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hashes_are_fixed_width_uppercase() {
        let value = xxh128_hex("Zeepkist");
        assert_eq!(value.len(), 32);
        assert!(
            value
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'A'..=b'F').contains(&byte))
        );
    }

    #[test]
    fn generated_ids_are_ulids() {
        let value = generate_uid();
        assert_eq!(value.len(), 26);
        assert!(Ulid::from_string(&value).is_ok());
    }
}
