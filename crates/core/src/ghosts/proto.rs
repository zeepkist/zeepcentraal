#[derive(Clone, PartialEq, ::prost::Message)]
pub(crate) struct Vector3 {
    #[prost(float, tag = "1")]
    pub x: f32,
    #[prost(float, tag = "2")]
    pub y: f32,
    #[prost(float, tag = "3")]
    pub z: f32,
}

#[derive(Clone, PartialEq, ::prost::Message)]
pub(crate) struct Vector3Int {
    #[prost(int32, tag = "1")]
    pub x: i32,
    #[prost(int32, tag = "2")]
    pub y: i32,
    #[prost(int32, tag = "3")]
    pub z: i32,
}

#[derive(Clone, PartialEq, ::prost::Message)]
pub(crate) struct Vector2Int {
    #[prost(int32, tag = "1")]
    pub x: i32,
    #[prost(int32, tag = "2")]
    pub y: i32,
}

#[derive(Clone, PartialEq, ::prost::Message)]
pub(crate) struct Cosmetics {
    #[prost(int32, tag = "1")]
    pub zeepkist: i32,
    #[prost(int32, tag = "2")]
    pub front_wheels: i32,
    #[prost(int32, tag = "3")]
    pub rear_wheels: i32,
    #[prost(int32, tag = "4")]
    pub paraglider: i32,
    #[prost(int32, tag = "5")]
    pub horn: i32,
    #[prost(int32, tag = "6")]
    pub hat: i32,
    #[prost(int32, tag = "7")]
    pub glasses: i32,
    #[prost(int32, tag = "8")]
    pub color_body: i32,
    #[prost(int32, tag = "9")]
    pub color_left_arm: i32,
    #[prost(int32, tag = "10")]
    pub color_right_arm: i32,
    #[prost(int32, tag = "11")]
    pub color_left_leg: i32,
    #[prost(int32, tag = "12")]
    pub color_right_leg: i32,
    #[prost(int32, tag = "13")]
    pub color: i32,
}

#[derive(Clone, PartialEq, ::prost::Message)]
pub(crate) struct InitialFrame {
    #[prost(message, optional, tag = "1")]
    pub position: Option<Vector3>,
    #[prost(message, optional, tag = "2")]
    pub rotation: Option<Vector3>,
    #[prost(uint32, tag = "3")]
    pub speed: u32,
    #[prost(uint32, tag = "4")]
    pub steering: u32,
    #[prost(int32, tag = "5")]
    pub input_flags: i32,
    #[prost(int32, tag = "6")]
    pub soapbox_flags: i32,
    #[prost(int32, tag = "7")]
    pub grounded_wheel_state: i32,
    #[prost(int32, tag = "8")]
    pub slipping_wheel_state: i32,
    #[prost(int32, tag = "9")]
    pub surface_state: i32,
    #[prost(message, optional, tag = "10")]
    pub local_velocity: Option<Vector3Int>,
    #[prost(message, optional, tag = "11")]
    pub local_angular_velocity: Option<Vector3Int>,
    #[prost(message, optional, tag = "12")]
    pub local_g_force: Option<Vector2Int>,
    #[prost(bool, tag = "13")]
    pub parking_block_state: bool,
    #[prost(bool, tag = "14")]
    pub monorail_state: bool,
    #[prost(bool, tag = "15")]
    pub ragdoll_state: bool,
    #[prost(message, optional, tag = "16")]
    pub ragdoll_position: Option<Vector3Int>,
    #[prost(message, optional, tag = "17")]
    pub ragdoll_rotation: Option<Vector3Int>,
}

#[derive(Clone, PartialEq, ::prost::Message)]
pub(crate) struct DeltaFrame {
    #[prost(float, tag = "1")]
    pub time: f32,
    #[prost(message, optional, tag = "2")]
    pub position: Option<Vector3Int>,
    #[prost(message, optional, tag = "3")]
    pub rotation: Option<Vector3Int>,
    #[prost(uint32, tag = "4")]
    pub speed: u32,
    #[prost(uint32, tag = "5")]
    pub steering: u32,
    #[prost(int32, tag = "6")]
    pub input_flags: i32,
    #[prost(int32, tag = "7")]
    pub soapbox_flags: i32,
    #[prost(int32, tag = "8")]
    pub grounded_wheel_state: i32,
    #[prost(int32, tag = "9")]
    pub slipping_wheel_state: i32,
    #[prost(int32, tag = "10")]
    pub surface_state: i32,
    #[prost(message, optional, tag = "11")]
    pub local_velocity: Option<Vector3Int>,
    #[prost(message, optional, tag = "12")]
    pub local_angular_velocity: Option<Vector3Int>,
    #[prost(message, optional, tag = "13")]
    pub local_g_force: Option<Vector2Int>,
    #[prost(bool, tag = "14")]
    pub parking_block_state: bool,
    #[prost(bool, tag = "15")]
    pub monorail_state: bool,
    #[prost(bool, tag = "16")]
    pub ragdoll_state: bool,
    #[prost(message, optional, tag = "17")]
    pub ragdoll_position: Option<Vector3Int>,
    #[prost(message, optional, tag = "18")]
    pub ragdoll_rotation: Option<Vector3Int>,
}

#[derive(Clone, PartialEq, ::prost::Message)]
pub(crate) struct Ghost {
    #[prost(int32, tag = "1")]
    pub version: i32,
    #[prost(uint64, tag = "2")]
    pub steam_id: u64,
    #[prost(message, optional, tag = "3")]
    pub cosmetics: Option<Cosmetics>,
    #[prost(message, optional, tag = "4")]
    pub initial_frame: Option<InitialFrame>,
    #[prost(message, repeated, tag = "5")]
    pub delta_frames: Vec<DeltaFrame>,
    #[prost(string, tag = "6")]
    pub tagged_username: String,
    #[prost(string, tag = "7")]
    pub color: String,
}
