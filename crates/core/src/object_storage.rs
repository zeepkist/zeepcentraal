use crate::config::ObjectStorageConfig;
use anyhow::{Context, Result, ensure};
use async_trait::async_trait;
use s3::{Auth, Client, Credentials};
use sha2::{Digest, Sha256};

#[derive(Clone, Copy, Debug, Default)]
pub struct DownloadConstraints<'a> {
    pub max_bytes: usize,
    pub expected_bytes: Option<usize>,
    pub expected_sha256: Option<&'a str>,
}

#[async_trait]
pub trait ObjectStorage: Send + Sync {
    async fn upload(&self, key: &str, contents: Vec<u8>, content_type: &str) -> Result<()>;
    async fn download(&self, key: &str, constraints: DownloadConstraints<'_>) -> Result<Vec<u8>>;
    async fn delete(&self, key: &str) -> Result<()>;
}

#[derive(Clone)]
pub struct S3ObjectStorage {
    client: Client,
    bucket: String,
}

impl S3ObjectStorage {
    pub fn new(config: &ObjectStorageConfig) -> Result<Self> {
        let credentials = Credentials::new(&config.access_key, &config.secret_key)
            .context("invalid Wasabi credentials")?;
        let client = Client::builder(&config.endpoint)
            .context("invalid Wasabi endpoint")?
            .region(&config.region)
            .auth(Auth::Static(credentials))
            .max_attempts(5)
            .build()
            .context("failed to create Wasabi client")?;
        Ok(Self {
            client,
            bucket: config.bucket.clone(),
        })
    }

    fn validate_key(key: &str) -> Result<()> {
        ensure!(!key.is_empty(), "S3 object key is empty");
        ensure!(!key.starts_with('/'), "S3 object key must be relative");
        ensure!(
            !key.split('/').any(|segment| segment == ".."),
            "S3 object key contains parent traversal"
        );
        Ok(())
    }
}

#[async_trait]
impl ObjectStorage for S3ObjectStorage {
    async fn upload(&self, key: &str, contents: Vec<u8>, content_type: &str) -> Result<()> {
        Self::validate_key(key)?;
        ensure!(!content_type.is_empty(), "S3 content type is empty");
        self.client
            .objects()
            .put(&self.bucket, key)
            .content_type(content_type)
            .context("invalid S3 content type")?
            .body_bytes(contents)
            .send()
            .await
            .with_context(|| format!("failed to upload S3 object {key}"))?;
        Ok(())
    }

    async fn download(&self, key: &str, constraints: DownloadConstraints<'_>) -> Result<Vec<u8>> {
        Self::validate_key(key)?;
        ensure!(
            constraints.max_bytes > 0,
            "S3 download max bytes must be positive"
        );
        if let Some(expected) = constraints.expected_sha256 {
            ensure!(
                expected.len() == 64 && expected.bytes().all(|byte| byte.is_ascii_hexdigit()),
                "Expected S3 SHA256 is invalid"
            );
        }

        let head = self
            .client
            .objects()
            .head(&self.bucket, key)
            .send()
            .await
            .with_context(|| format!("failed to inspect S3 object {key}"))?;
        let declared = head
            .content_length
            .context("S3 object has no declared size")?;
        let declared = usize::try_from(declared).context("S3 object size exceeds usize")?;
        ensure!(
            declared <= constraints.max_bytes,
            "S3 object exceeds {} bytes",
            constraints.max_bytes
        );
        if let Some(expected) = constraints.expected_bytes {
            ensure!(
                declared == expected,
                "S3 object size does not match expected bytes"
            );
        }

        let response = self
            .client
            .objects()
            .get(&self.bucket, key)
            .send()
            .await
            .with_context(|| format!("failed to download S3 object {key}"))?;
        let bytes = response
            .bytes()
            .await
            .with_context(|| format!("failed to read S3 object {key}"))?
            .to_vec();
        ensure!(
            bytes.len() == declared,
            "S3 object size changed while downloading"
        );
        if let Some(expected) = constraints.expected_sha256 {
            let actual = format!("{:x}", Sha256::digest(&bytes));
            ensure!(
                actual.eq_ignore_ascii_case(expected),
                "S3 object SHA256 does not match expected digest"
            );
        }
        Ok(bytes)
    }

    async fn delete(&self, key: &str) -> Result<()> {
        Self::validate_key(key)?;
        self.client
            .objects()
            .delete(&self.bucket, key)
            .send()
            .await
            .with_context(|| format!("failed to delete S3 object {key}"))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unsafe_keys() {
        assert!(S3ObjectStorage::validate_key("").is_err());
        assert!(S3ObjectStorage::validate_key("/ghosts/a.bin").is_err());
        assert!(S3ObjectStorage::validate_key("ghosts/../a.bin").is_err());
        assert!(S3ObjectStorage::validate_key("ghosts/a.bin").is_ok());
    }
}
