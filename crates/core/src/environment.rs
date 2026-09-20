use anyhow::{Context, Result, ensure};
use rust_env::{Env, Wrapper};
use std::{
    env::VarError,
    path::{Path, PathBuf},
    sync::OnceLock,
};

const ENV_FILE_VARIABLE: &str = "ZC_ENV_FILE";
static SOURCE: OnceLock<EnvironmentSource> = OnceLock::new();

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum VariableSource {
    Process,
    LocalFile,
}

impl std::fmt::Display for VariableSource {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(match self {
            Self::Process => "Process",
            Self::LocalFile => "LocalFile",
        })
    }
}

struct EnvironmentSource {
    local: Option<Env>,
}

impl EnvironmentSource {
    fn load() -> Result<Self> {
        if let Some(path) = std::env::var_os(ENV_FILE_VARIABLE) {
            ensure!(!path.is_empty(), "{ENV_FILE_VARIABLE} must not be empty");
            return Self::from_path(&PathBuf::from(path), true);
        }
        if std::env::var("NODE_ENV").as_deref() == Ok("production") {
            return Ok(Self { local: None });
        }
        match discover_env_file()? {
            Some(path) => Self::from_path(&path, false),
            None => Ok(Self { local: None }),
        }
    }

    fn from_path(path: &Path, required: bool) -> Result<Self> {
        if !path.exists() {
            ensure!(!required, "{} does not exist", path.display());
            return Ok(Self { local: None });
        }
        let contents = std::fs::read_to_string(path)
            .with_context(|| format!("failed to read environment file {}", path.display()))?;
        Ok(Self {
            local: Some(Env {
                data: Env::parse(&contents),
                global: Vec::new(),
                path: path.to_string_lossy().into_owned(),
            }),
        })
    }

    fn var(&self, name: &str) -> Result<String, VarError> {
        self.var_with_source(name).map(|(value, _)| value)
    }

    fn var_with_source(&self, name: &str) -> Result<(String, VariableSource), VarError> {
        match std::env::var(name) {
            Ok(value) => Ok((value, VariableSource::Process)),
            Err(VarError::NotUnicode(value)) => Err(VarError::NotUnicode(value)),
            Err(VarError::NotPresent) => self
                .local_var(name)
                .map(|value| (value, VariableSource::LocalFile)),
        }
    }

    fn local_var(&self, name: &str) -> Result<String, VarError> {
        match self.local.as_ref().map(|env| env.get_local(name)) {
            Some(Wrapper::Str(value)) => Ok(value),
            Some(Wrapper::Vec(values)) => Ok(values.join(";")),
            Some(Wrapper::Empty) | None => Err(VarError::NotPresent),
        }
    }
}

pub fn initialize() -> Result<()> {
    if SOURCE.get().is_some() {
        return Ok(());
    }
    let source = EnvironmentSource::load()?;
    let _ = SOURCE.set(source);
    Ok(())
}

pub fn var(name: &str) -> Result<String, VarError> {
    match SOURCE.get() {
        Some(source) => source.var(name),
        None => std::env::var(name),
    }
}

pub fn var_with_source(name: &str) -> Result<(String, VariableSource), VarError> {
    match SOURCE.get() {
        Some(source) => source.var_with_source(name),
        None => std::env::var(name).map(|value| (value, VariableSource::Process)),
    }
}

pub fn source(name: &str) -> Result<VariableSource, VarError> {
    var_with_source(name).map(|(_, source)| source)
}

fn discover_env_file() -> Result<Option<PathBuf>> {
    let mut directory = std::env::current_dir().context("failed to resolve current directory")?;
    loop {
        let candidate = directory.join(".env");
        if candidate.is_file() {
            return Ok(Some(candidate));
        }
        if !directory.pop() {
            return Ok(None);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temporary_file(contents: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!(
            "zc-rust-env-{}-{}.env",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::write(&path, contents).unwrap();
        path
    }

    #[test]
    fn loads_local_strings_without_mutating_process_environment() {
        let path = temporary_file("ZC_LOCAL_ONLY=value\nZC_LIST=a;b;c\nPATH=local\n");
        let source = EnvironmentSource::from_path(&path, true).unwrap();

        assert_eq!(source.local_var("ZC_LOCAL_ONLY").unwrap(), "value");
        assert_eq!(
            source.var_with_source("ZC_LOCAL_ONLY").unwrap(),
            ("value".to_owned(), VariableSource::LocalFile)
        );
        assert_eq!(source.local_var("ZC_LIST").unwrap(), "a;b;c");
        assert_eq!(source.var("PATH").unwrap(), std::env::var("PATH").unwrap());
        assert_eq!(
            source.var_with_source("PATH").unwrap().1,
            VariableSource::Process
        );
        assert!(matches!(
            source.local_var("ZC_MISSING"),
            Err(VarError::NotPresent)
        ));

        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn explicit_missing_file_is_an_error() {
        let path = std::env::temp_dir().join(format!(
            "zc-rust-env-missing-{}-{}.env",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        assert!(EnvironmentSource::from_path(&path, true).is_err());
    }
}
