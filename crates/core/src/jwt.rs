use anyhow::{Context, Result, ensure};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use hmac::{Hmac, KeyInit, Mac};
use jwt::{
    SignWithKey, VerifyWithKey,
    algorithm::{AlgorithmType, SigningAlgorithm, VerifyingAlgorithm},
};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    Gtr,
    Steam,
    Discord,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct AccessTokenClaims {
    pub jti: String,
    pub aud: String,
    pub exp: u64,
    pub iat: u64,
    pub iss: String,
    pub sub: String,
    pub steamid: String,
    pub provider: Provider,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub discordid: Option<String>,
}

#[derive(Clone)]
pub struct JwtIssuer {
    secret: Vec<u8>,
    audience: String,
    issuer: String,
    access_ttl: Duration,
    refresh_ttl: Duration,
}

pub struct TokenPair {
    pub access_token: String,
    pub access_token_expiry: i64,
    pub refresh_token: String,
    pub refresh_token_expiry: i64,
}

impl JwtIssuer {
    pub fn new(
        secret: impl AsRef<[u8]>,
        audience: impl Into<String>,
        issuer: impl Into<String>,
        access_ttl: Duration,
        refresh_ttl: Duration,
    ) -> Result<Self> {
        ensure!(
            secret.as_ref().len() >= 32,
            "JWT secret must contain at least 32 bytes"
        );
        ensure!(
            !access_ttl.is_zero() && !refresh_ttl.is_zero(),
            "JWT lifetimes must be positive"
        );
        Ok(Self {
            secret: secret.as_ref().to_vec(),
            audience: audience.into(),
            issuer: issuer.into(),
            access_ttl,
            refresh_ttl,
        })
    }

    pub fn issue(
        &self,
        provider: Provider,
        steam_id: &str,
        discord_id: Option<&str>,
    ) -> Result<TokenPair> {
        if provider == Provider::Discord {
            ensure!(discord_id.is_some(), "Discord provider requires discordId");
        }
        let now = unix_seconds()?;
        let access_expiry = now
            .checked_add(self.access_ttl.as_secs())
            .context("Access token expiry overflow")?;
        let refresh_expiry = now
            .checked_add(self.refresh_ttl.as_secs())
            .context("Refresh token expiry overflow")?;
        let claims = AccessTokenClaims {
            jti: uuid::Uuid::new_v4().to_string(),
            aud: self.audience.clone(),
            exp: access_expiry,
            iat: now,
            iss: self.issuer.clone(),
            sub: steam_id.to_owned(),
            steamid: steam_id.to_owned(),
            provider,
            discordid: discord_id.map(str::to_owned),
        };
        let key = Hs256Key(Hmac::new_from_slice(&self.secret).context("Invalid JWT key")?);
        Ok(TokenPair {
            access_token: claims.sign_with_key(&key).context("Failed to sign JWT")?,
            access_token_expiry: i64::try_from(access_expiry)?,
            refresh_token: uuid::Uuid::new_v4().to_string(),
            refresh_token_expiry: i64::try_from(refresh_expiry)?,
        })
    }

    pub fn verify(&self, token: &str) -> Result<AccessTokenClaims> {
        let key = Hs256Key(Hmac::new_from_slice(&self.secret).context("Invalid JWT key")?);
        let claims: AccessTokenClaims = token
            .verify_with_key(&key)
            .context("Invalid JWT signature")?;
        ensure!(
            claims.aud == self.audience && claims.iss == self.issuer,
            "Invalid token claims"
        );
        ensure!(
            !claims.sub.is_empty() && claims.sub == claims.steamid,
            "Invalid token claims"
        );
        ensure!(claims.exp > unix_seconds()?, "Access token expired");
        if claims.provider == Provider::Discord {
            ensure!(
                claims.discordid.as_deref().is_some_and(|id| !id.is_empty()),
                "Invalid discord token claims"
            );
        }
        Ok(claims)
    }

    pub fn discord_link_hash(&self, namespace: &str, value: &str) -> Result<String> {
        crate::discord::hash_link_value(&self.secret, namespace, value)
    }
}

// jwt 0.16's built-in signer uses hmac 0.12. Keep its token format and
// algorithm checks while signing with the workspace's RustCrypto version.
struct Hs256Key(Hmac<Sha256>);

impl Hs256Key {
    fn mac(&self, header: &str, claims: &str) -> Hmac<Sha256> {
        let mut mac = self.0.clone();
        mac.update(header.as_bytes());
        mac.update(b".");
        mac.update(claims.as_bytes());
        mac
    }
}

impl SigningAlgorithm for Hs256Key {
    fn algorithm_type(&self) -> AlgorithmType {
        AlgorithmType::Hs256
    }

    fn sign(&self, header: &str, claims: &str) -> Result<String, jwt::Error> {
        Ok(URL_SAFE_NO_PAD.encode(self.mac(header, claims).finalize().into_bytes()))
    }
}

impl VerifyingAlgorithm for Hs256Key {
    fn algorithm_type(&self) -> AlgorithmType {
        AlgorithmType::Hs256
    }

    fn verify_bytes(
        &self,
        header: &str,
        claims: &str,
        signature: &[u8],
    ) -> Result<bool, jwt::Error> {
        self.mac(header, claims)
            .verify_slice(signature)
            .map_err(|_| jwt::Error::InvalidSignature)?;
        Ok(true)
    }
}

fn unix_seconds() -> Result<u64> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .context("System clock precedes Unix epoch")?
        .as_secs())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hs256_matches_known_signature_and_rejects_tampering() -> Result<()> {
        let key = Hs256Key(Hmac::new_from_slice(b"secret")?);
        let header = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
        let claims = "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWV9";
        let signature = "TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ";
        assert_eq!(key.sign(header, claims)?, signature);
        assert!(key.verify(header, claims, signature)?);
        assert!(key.verify(header, "e30", signature).is_err());
        assert!(key.verify("e30", claims, signature).is_err());
        assert!(key.verify(header, claims, "AA").is_err());
        Ok(())
    }

    #[test]
    fn hs256_rejects_other_algorithms() -> Result<()> {
        let key = Hs256Key(Hmac::new_from_slice(b"secret")?);
        for algorithm in ["none", "HS384", "HS512"] {
            let header = URL_SAFE_NO_PAD.encode(format!(r#"{{"alg":"{algorithm}","typ":"JWT"}}"#));
            let claims = URL_SAFE_NO_PAD.encode("{}");
            let signature = key.sign(&header, &claims)?;
            let token = format!("{header}.{claims}.{signature}");
            let result: Result<serde_json::Value, _> = token.verify_with_key(&key);
            assert!(matches!(result, Err(jwt::Error::AlgorithmMismatch(_, _))));
        }
        Ok(())
    }

    #[test]
    fn preserves_v1_claim_names() -> Result<()> {
        let issuer = JwtIssuer::new(
            [7; 32],
            "zeepki.st",
            "https://zeepki.st",
            Duration::from_secs(900),
            Duration::from_secs(604_800),
        )?;
        let pair = issuer.issue(Provider::Discord, "76561198000000000", Some("123"))?;
        let claims = issuer.verify(&pair.access_token)?;
        assert_eq!(claims.steamid, "76561198000000000");
        assert_eq!(claims.discordid.as_deref(), Some("123"));
        assert!(pair.refresh_token_expiry > pair.access_token_expiry);
        Ok(())
    }
}
