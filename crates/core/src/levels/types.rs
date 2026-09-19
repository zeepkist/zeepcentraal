use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LevelFormat {
    Csv,
    Json,
}

impl LevelFormat {
    #[must_use]
    pub const fn database_value(self) -> i32 {
        match self {
            Self::Csv => 0,
            Self::Json => 1,
        }
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct Vector3 {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct CsvBlock {
    pub id: i64,
    pub position: Vector3,
    pub euler: Vector3,
    pub scale: Vector3,
    pub paints: Vec<i64>,
    pub options: Vec<f32>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum LevelBlocks {
    Csv(Vec<CsvBlock>),
    Json(Vec<serde_json::Value>),
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedLevel {
    pub format: LevelFormat,
    pub hash: String,
    pub zeep_hash: String,
    pub uid: String,
    pub author_id: u64,
    pub file_author: String,
    pub validation_time_author: f64,
    pub validation_time_gold: f64,
    pub validation_time_silver: f64,
    pub validation_time_bronze: f64,
    pub amount_checkpoints: usize,
    pub amount_finishes: usize,
    pub amount_blocks: usize,
    pub type_ground: i64,
    pub type_skybox: i64,
    pub blocks: LevelBlocks,
}
