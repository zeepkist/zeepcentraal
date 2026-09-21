#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Vector2 {
    pub x: f64,
    pub y: f64,
}

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Vector3 {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Quaternion {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub w: f64,
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct GhostCosmetics {
    pub zeepkist: Option<i32>,
    pub front_wheels: Option<i32>,
    pub rear_wheels: Option<i32>,
    pub paraglider: Option<i32>,
    pub horn: Option<i32>,
    pub hat: Option<i32>,
    pub glasses: Option<i32>,
    pub color_body: Option<i32>,
    pub color_left_arm: Option<i32>,
    pub color_right_arm: Option<i32>,
    pub color_left_leg: Option<i32>,
    pub color_right_leg: Option<i32>,
    pub color: Option<i32>,
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct GhostMetadata {
    pub steam_id: Option<String>,
    pub tagged_username: Option<String>,
    pub color: Option<String>,
    pub cosmetics: Option<GhostCosmetics>,
}

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum Surface {
    Tarmac,
    Grass,
    Sand,
    Soap,
    Wood,
    Mud,
    Ice1,
    Ice2,
    Ice3,
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct GhostFrame {
    pub time: f64,
    pub position: Vector3,
    pub rotation: Option<Vector3>,
    pub orientation: Option<Quaternion>,
    pub speed: Option<f64>,
    pub steering: Option<f64>,
    pub arms_up: Option<bool>,
    pub braking: Option<bool>,
    pub horn: Option<bool>,
    pub soap: Option<bool>,
    pub offroad: Option<bool>,
    pub paraglider: Option<bool>,
    pub grounded_wheel_state: Option<i32>,
    pub slipping_wheel_state: Option<i32>,
    pub surfaces: Vec<Surface>,
    pub local_velocity: Option<Vector3>,
    pub local_angular_velocity: Option<Vector3>,
    pub local_g_force: Option<Vector2>,
    pub parking_block: Option<bool>,
    pub monorail: Option<bool>,
    pub ragdoll: Option<bool>,
    pub ragdoll_position: Option<Vector3>,
    pub ragdoll_rotation: Option<Vector3>,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct GhostCapabilities {
    pub input: bool,
    pub air: bool,
    pub wheels: bool,
    pub slipping: bool,
    pub state: bool,
    pub surfaces: bool,
    pub velocity: bool,
    pub ragdoll: bool,
    pub orientation: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub struct ParsedGhost {
    pub version: i32,
    pub metadata: GhostMetadata,
    pub capabilities: GhostCapabilities,
    pub frames: Vec<GhostFrame>,
}

#[derive(Clone, Debug, Default, PartialEq, serde::Serialize)]
pub struct GhostStatistics {
    pub ghost_version: Option<i32>,
    pub has_input_data: bool,
    pub has_air_data: bool,
    pub has_wheel_data: bool,
    pub has_slip_data: bool,
    pub has_state_data: bool,
    pub has_surface_data: bool,
    pub has_velocity_data: bool,
    pub has_ragdoll_data: bool,
    pub frame_count: Option<i32>,
    pub time: Option<f64>,
    pub distance: Option<f64>,
    pub distance_in_air: Option<f64>,
    pub distance_on_ground: Option<f64>,
    pub distance_on_1_wheel: Option<f64>,
    pub distance_on_2_wheels: Option<f64>,
    pub distance_on_3_wheels: Option<f64>,
    pub distance_on_4_wheels: Option<f64>,
    pub time_in_air: Option<f64>,
    pub time_on_ground: Option<f64>,
    pub time_on_1_wheel: Option<f64>,
    pub time_on_2_wheels: Option<f64>,
    pub time_on_3_wheels: Option<f64>,
    pub time_on_4_wheels: Option<f64>,
    pub average_speed: Option<f64>,
    pub max_speed: Option<f64>,
    pub arms_up_count: Option<i32>,
    pub arms_up_time: Option<f64>,
    pub brake_count: Option<i32>,
    pub brake_time: Option<f64>,
    pub turn_left_count: Option<i32>,
    pub turn_left_time: Option<f64>,
    pub turn_right_count: Option<i32>,
    pub turn_right_time: Option<f64>,
    pub horn_count: Option<i32>,
    pub horn_time: Option<f64>,
    pub distance_slipping: Option<f64>,
    pub distance_paraglider: Option<f64>,
    pub distance_offroad_wheels: Option<f64>,
    pub distance_soap_wheels: Option<f64>,
    pub distance_on_monorail: Option<f64>,
    pub distance_parked: Option<f64>,
    pub distance_ragdoll: Option<f64>,
    pub time_slipping: Option<f64>,
    pub time_paraglider: Option<f64>,
    pub time_offroad_wheels: Option<f64>,
    pub time_soap_wheels: Option<f64>,
    pub time_on_monorail: Option<f64>,
    pub time_parked: Option<f64>,
    pub time_ragdoll: Option<f64>,
    pub distance_on_tarmac: Option<f64>,
    pub distance_on_grass: Option<f64>,
    pub distance_on_sand: Option<f64>,
    pub distance_on_soap: Option<f64>,
    pub distance_on_wood: Option<f64>,
    pub distance_on_mud: Option<f64>,
    pub distance_on_ice1: Option<f64>,
    pub distance_on_ice2: Option<f64>,
    pub distance_on_ice3: Option<f64>,
    pub time_on_tarmac: Option<f64>,
    pub time_on_grass: Option<f64>,
    pub time_on_sand: Option<f64>,
    pub time_on_soap: Option<f64>,
    pub time_on_wood: Option<f64>,
    pub time_on_mud: Option<f64>,
    pub time_on_ice1: Option<f64>,
    pub time_on_ice2: Option<f64>,
    pub time_on_ice3: Option<f64>,
    pub average_velocity: Option<f64>,
    pub max_velocity: Option<f64>,
    pub average_angular_velocity: Option<f64>,
    pub max_angular_velocity: Option<f64>,
    pub average_gforce: Option<f64>,
    pub max_gforce: Option<f64>,
    pub time_any_driver_input: Option<f64>,
    pub driver_input_transition_count: Option<i32>,
}
