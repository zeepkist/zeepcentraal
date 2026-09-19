use std::io::{self, Cursor, Read, Write};

use flate2::read::GzDecoder;
use prost::Message;

use super::proto;
use super::types::{
    GhostCapabilities, GhostCosmetics, GhostFrame, GhostMetadata, ParsedGhost, Quaternion, Surface,
    Vector2, Vector3,
};
use super::{MAX_GHOST_COMPRESSED_BYTES, MAX_GHOST_DECOMPRESSED_BYTES, MAX_GHOST_FRAMES};

const POSITION_MULTIPLIER: f64 = 100_000.0;
const ROTATION_MULTIPLIER: f64 = 100.0;

#[derive(Debug, thiserror::Error)]
pub enum GhostError {
    #[error("ghost exceeds {limit} {kind}")]
    Limit { kind: &'static str, limit: usize },
    #[error("invalid ghost: {0}")]
    Invalid(&'static str),
    #[error("unsupported ghost version {0}")]
    Unsupported(i32),
    #[error("ghost decompression failed: {0}")]
    Decompression(String),
    #[error("ghost protobuf decoding failed: {0}")]
    Protobuf(#[from] prost::DecodeError),
}

pub fn parse_ghost(input: &[u8]) -> Result<ParsedGhost, GhostError> {
    enforce_compressed_size(input.len())?;
    let legacy_payload = decompress_gzip_or_raw(input)?;
    if let Some(version) = read_version(&legacy_payload)
        && (1..=4).contains(&version)
    {
        return parse_legacy(&legacy_payload, version);
    }

    let payload = decompress_lzma(input)?;
    let decoded = proto::Ghost::decode(payload.as_slice())?;
    parse_protobuf(decoded)
}

fn enforce_compressed_size(size: usize) -> Result<(), GhostError> {
    if size > MAX_GHOST_COMPRESSED_BYTES {
        return Err(GhostError::Limit {
            kind: "compressed bytes",
            limit: MAX_GHOST_COMPRESSED_BYTES,
        });
    }
    Ok(())
}

fn enforce_frame_count(count: usize) -> Result<(), GhostError> {
    if count > MAX_GHOST_FRAMES {
        return Err(GhostError::Limit {
            kind: "frames",
            limit: MAX_GHOST_FRAMES,
        });
    }
    Ok(())
}

fn decompress_gzip_or_raw(input: &[u8]) -> Result<Vec<u8>, GhostError> {
    if !input.starts_with(&[0x1f, 0x8b]) {
        if input.len() > MAX_GHOST_DECOMPRESSED_BYTES {
            return Err(GhostError::Limit {
                kind: "decompressed bytes",
                limit: MAX_GHOST_DECOMPRESSED_BYTES,
            });
        }
        return Ok(input.to_vec());
    }
    let decoder = GzDecoder::new(input);
    read_bounded(decoder)
}

fn decompress_lzma(input: &[u8]) -> Result<Vec<u8>, GhostError> {
    let mut output = BoundedWriter::new(MAX_GHOST_DECOMPRESSED_BYTES);
    lzma_rs::lzma_decompress(&mut Cursor::new(input), &mut output)
        .map_err(|error| GhostError::Decompression(error.to_string()))?;
    Ok(output.into_inner())
}

fn read_bounded(reader: impl Read) -> Result<Vec<u8>, GhostError> {
    let mut output = Vec::new();
    reader
        .take((MAX_GHOST_DECOMPRESSED_BYTES + 1) as u64)
        .read_to_end(&mut output)
        .map_err(|error| GhostError::Decompression(error.to_string()))?;
    if output.len() > MAX_GHOST_DECOMPRESSED_BYTES {
        return Err(GhostError::Limit {
            kind: "decompressed bytes",
            limit: MAX_GHOST_DECOMPRESSED_BYTES,
        });
    }
    Ok(output)
}

struct BoundedWriter {
    bytes: Vec<u8>,
    limit: usize,
}

impl BoundedWriter {
    fn new(limit: usize) -> Self {
        Self {
            bytes: Vec::new(),
            limit,
        }
    }

    fn into_inner(self) -> Vec<u8> {
        self.bytes
    }
}

impl Write for BoundedWriter {
    fn write(&mut self, buffer: &[u8]) -> io::Result<usize> {
        if self.bytes.len().saturating_add(buffer.len()) > self.limit {
            return Err(io::Error::other("ghost decompressed byte limit exceeded"));
        }
        self.bytes.extend_from_slice(buffer);
        Ok(buffer.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

fn read_version(payload: &[u8]) -> Option<i32> {
    let bytes: [u8; 4] = payload.get(..4)?.try_into().ok()?;
    Some(i32::from_le_bytes(bytes))
}

fn parse_legacy(payload: &[u8], version: i32) -> Result<ParsedGhost, GhostError> {
    let mut reader = BinaryReader::new(payload);
    if reader.i32()? != version {
        return Err(GhostError::Invalid("legacy version"));
    }
    let metadata = if version >= 2 {
        GhostMetadata {
            steam_id: Some(reader.u64()?.to_string()),
            cosmetics: Some(GhostCosmetics {
                zeepkist: Some(reader.i32()?),
                hat: Some(reader.i32()?),
                color: Some(reader.i32()?),
                ..GhostCosmetics::default()
            }),
            ..GhostMetadata::default()
        }
    } else {
        GhostMetadata::default()
    };

    let precision = if version == 4 {
        let value = reader.u8()?;
        if value == 0 {
            return Err(GhostError::Invalid("V4 precision"));
        }
        Some(value as usize)
    } else {
        None
    };
    let frame_count = reader.i32()?;
    if frame_count < 0 {
        return Err(GhostError::Invalid("frame count"));
    }
    enforce_frame_count(frame_count as usize)?;

    let mut frames = Vec::with_capacity(frame_count as usize);
    let mut current_position: Option<Vector3> = None;
    for index in 0..frame_count as usize {
        let time = reader.f32()? as f64;
        let frame = if version == 4 {
            let precision = precision.expect("V4 precision validated");
            let full = index % precision == 0
                || index == frame_count as usize - 1
                || current_position.is_none();
            let position = if full {
                reader.vector3_f32()?
            } else {
                let previous = current_position.expect("V4 previous position");
                Vector3 {
                    x: previous.x + f64::from(reader.i16()?) / 10_000.0,
                    y: previous.y + f64::from(reader.i16()?) / 10_000.0,
                    z: previous.z + f64::from(reader.i16()?) / 10_000.0,
                }
            };
            let scale = if full { 10_000.0 } else { 30_000.0 };
            let orientation = normalize_quaternion(Quaternion {
                x: f64::from(reader.i16()?) / scale,
                y: f64::from(reader.i16()?) / scale,
                z: f64::from(reader.i16()?) / scale,
                w: f64::from(reader.i16()?) / scale,
            });
            let steering = remap_byte(reader.u8()? as u32);
            let flags = reader.u8()?;
            current_position = Some(position);
            GhostFrame {
                time,
                position,
                orientation: Some(orientation),
                steering: Some(steering),
                arms_up: Some(flags & 1 != 0),
                braking: Some(flags & 2 != 0),
                ..GhostFrame::default()
            }
        } else {
            let position = reader.vector3_f32()?;
            let rotation = reader.vector3_f32()?;
            let mut frame = GhostFrame {
                time,
                position,
                rotation: Some(rotation),
                orientation: Some(unity_euler_to_quaternion(rotation)),
                ..GhostFrame::default()
            };
            if version >= 3 {
                frame.steering = Some(reader.f32()? as f64);
                frame.arms_up = Some(reader.u8()? != 0);
                frame.braking = Some(reader.u8()? != 0);
            }
            frame
        };
        validate_frame(&frame)?;
        frames.push(frame);
    }
    let capabilities = detect_capabilities(&frames, version);
    Ok(ParsedGhost {
        version,
        metadata,
        capabilities,
        frames,
    })
}

fn parse_protobuf(decoded: proto::Ghost) -> Result<ParsedGhost, GhostError> {
    let version = decoded.version;
    if !(5..=7).contains(&version) {
        return Err(GhostError::Unsupported(version));
    }
    enforce_frame_count(decoded.delta_frames.len().saturating_add(1))?;
    let initial = decoded
        .initial_frame
        .as_ref()
        .ok_or(GhostError::Invalid("protobuf initial frame"))?;
    let initial_position = initial
        .position
        .as_ref()
        .map(vector3_float)
        .ok_or(GhostError::Invalid("protobuf initial position"))?;
    let extended = version >= 6;
    let mut position = initial_position;
    let mut rotation = initial.rotation.as_ref().map(vector3_float);
    let mut ragdoll_active = extended && initial.ragdoll_state;
    let mut ragdoll_position = if ragdoll_active {
        Some(unscale3(
            initial
                .ragdoll_position
                .as_ref()
                .ok_or(GhostError::Invalid("protobuf ragdoll frame"))?,
            POSITION_MULTIPLIER,
        ))
    } else {
        None
    };
    let mut ragdoll_rotation = if ragdoll_active {
        Some(unscale3(
            initial
                .ragdoll_rotation
                .as_ref()
                .ok_or(GhostError::Invalid("protobuf ragdoll frame"))?,
            ROTATION_MULTIPLIER,
        ))
    } else {
        None
    };

    let mut frames = Vec::with_capacity(decoded.delta_frames.len() + 1);
    frames.push(frame_from_initial(
        initial,
        version,
        position,
        rotation,
        ragdoll_position,
        ragdoll_rotation,
    )?);

    for delta in &decoded.delta_frames {
        let change = delta
            .position
            .as_ref()
            .ok_or(GhostError::Invalid("protobuf position delta"))?;
        position.x += f64::from(change.x) / POSITION_MULTIPLIER;
        position.y += f64::from(change.y) / POSITION_MULTIPLIER;
        position.z += f64::from(change.z) / POSITION_MULTIPLIER;
        if let Some(value) = &delta.rotation {
            rotation = Some(unscale3(value, ROTATION_MULTIPLIER));
        }
        if extended && ragdoll_active && !delta.ragdoll_state {
            return Err(GhostError::Invalid("protobuf ragdoll state"));
        }
        if extended && delta.ragdoll_state {
            let position_delta = unscale3(
                delta
                    .ragdoll_position
                    .as_ref()
                    .ok_or(GhostError::Invalid("protobuf ragdoll frame"))?,
                POSITION_MULTIPLIER,
            );
            let rotation_delta = unscale3(
                delta
                    .ragdoll_rotation
                    .as_ref()
                    .ok_or(GhostError::Invalid("protobuf ragdoll frame"))?,
                ROTATION_MULTIPLIER,
            );
            ragdoll_position = Some(if ragdoll_active {
                add3(
                    ragdoll_position.expect("active ragdoll position"),
                    position_delta,
                )
            } else {
                position_delta
            });
            ragdoll_rotation = Some(if ragdoll_active {
                add3(
                    ragdoll_rotation.expect("active ragdoll rotation"),
                    rotation_delta,
                )
            } else {
                rotation_delta
            });
            ragdoll_active = true;
        }
        frames.push(frame_from_delta(
            delta,
            version,
            position,
            rotation,
            ragdoll_position,
            ragdoll_rotation,
        )?);
    }

    let metadata = protobuf_metadata(&decoded);
    let capabilities = detect_capabilities(&frames, version);
    Ok(ParsedGhost {
        version,
        metadata,
        capabilities,
        frames,
    })
}

fn protobuf_metadata(decoded: &proto::Ghost) -> GhostMetadata {
    let cosmetics = decoded.cosmetics.as_ref().map(|value| GhostCosmetics {
        zeepkist: Some(value.zeepkist),
        front_wheels: Some(value.front_wheels),
        rear_wheels: Some(value.rear_wheels),
        paraglider: Some(value.paraglider),
        horn: Some(value.horn),
        hat: Some(value.hat),
        glasses: Some(value.glasses),
        color_body: Some(value.color_body),
        color_left_arm: Some(value.color_left_arm),
        color_right_arm: Some(value.color_right_arm),
        color_left_leg: Some(value.color_left_leg),
        color_right_leg: Some(value.color_right_leg),
        color: Some(value.color),
    });
    GhostMetadata {
        steam_id: Some(decoded.steam_id.to_string()),
        tagged_username: (!decoded.tagged_username.is_empty())
            .then(|| decoded.tagged_username.clone()),
        color: normalize_color(&decoded.color),
        cosmetics,
    }
}

fn normalize_color(value: &str) -> Option<String> {
    (value.len() == 9
        && value.starts_with('#')
        && value[1..].bytes().all(|byte| byte.is_ascii_hexdigit()))
    .then(|| value.to_ascii_uppercase())
}

fn frame_from_initial(
    source: &proto::InitialFrame,
    version: i32,
    position: Vector3,
    rotation: Option<Vector3>,
    ragdoll_position: Option<Vector3>,
    ragdoll_rotation: Option<Vector3>,
) -> Result<GhostFrame, GhostError> {
    frame_from_wire(
        0.0,
        position,
        rotation,
        version,
        source.speed,
        source.steering,
        source.input_flags,
        source.soapbox_flags,
        source.grounded_wheel_state,
        source.slipping_wheel_state,
        source.surface_state,
        source.local_velocity.as_ref(),
        source.local_angular_velocity.as_ref(),
        source.local_g_force.as_ref(),
        source.parking_block_state,
        source.monorail_state,
        source.ragdoll_state,
        ragdoll_position,
        ragdoll_rotation,
    )
}

fn frame_from_delta(
    source: &proto::DeltaFrame,
    version: i32,
    position: Vector3,
    rotation: Option<Vector3>,
    ragdoll_position: Option<Vector3>,
    ragdoll_rotation: Option<Vector3>,
) -> Result<GhostFrame, GhostError> {
    frame_from_wire(
        f64::from(source.time),
        position,
        rotation,
        version,
        source.speed,
        source.steering,
        source.input_flags,
        source.soapbox_flags,
        source.grounded_wheel_state,
        source.slipping_wheel_state,
        source.surface_state,
        source.local_velocity.as_ref(),
        source.local_angular_velocity.as_ref(),
        source.local_g_force.as_ref(),
        source.parking_block_state,
        source.monorail_state,
        source.ragdoll_state,
        ragdoll_position,
        ragdoll_rotation,
    )
}

#[allow(clippy::too_many_arguments)]
fn frame_from_wire(
    time: f64,
    position: Vector3,
    rotation: Option<Vector3>,
    version: i32,
    speed: u32,
    steering: u32,
    input_flags: i32,
    soapbox_flags: i32,
    grounded_wheel_state: i32,
    slipping_wheel_state: i32,
    surface_state: i32,
    local_velocity: Option<&proto::Vector3Int>,
    local_angular_velocity: Option<&proto::Vector3Int>,
    local_g_force: Option<&proto::Vector2Int>,
    parking_block: bool,
    monorail: bool,
    ragdoll: bool,
    ragdoll_position: Option<Vector3>,
    ragdoll_rotation: Option<Vector3>,
) -> Result<GhostFrame, GhostError> {
    let extended = version >= 6;
    let frame = GhostFrame {
        time,
        position,
        rotation,
        orientation: rotation.map(unity_euler_to_quaternion),
        speed: Some(f64::from(speed)),
        steering: Some(remap_byte(steering)),
        arms_up: Some(input_flags & 1 != 0),
        braking: Some(input_flags & 2 != 0),
        horn: Some(input_flags & 4 != 0),
        soap: Some(soapbox_flags & 1 != 0),
        offroad: Some(soapbox_flags & 2 != 0),
        paraglider: Some(soapbox_flags & 4 != 0),
        grounded_wheel_state: extended.then_some(grounded_wheel_state),
        slipping_wheel_state: extended.then_some(slipping_wheel_state),
        surfaces: if extended {
            surfaces_from_state(surface_state, version)
        } else {
            Vec::new()
        },
        local_velocity: extended
            .then(|| local_velocity.map(|value| unscale3(value, POSITION_MULTIPLIER)))
            .flatten(),
        local_angular_velocity: extended
            .then(|| local_angular_velocity.map(|value| unscale3(value, ROTATION_MULTIPLIER)))
            .flatten(),
        local_g_force: extended
            .then(|| {
                local_g_force.map(|value| Vector2 {
                    x: f64::from(value.x) / POSITION_MULTIPLIER,
                    y: f64::from(value.y) / POSITION_MULTIPLIER,
                })
            })
            .flatten(),
        parking_block: extended.then_some(parking_block),
        monorail: extended.then_some(monorail),
        ragdoll: extended.then_some(ragdoll),
        ragdoll_position: extended.then_some(ragdoll_position).flatten(),
        ragdoll_rotation: extended.then_some(ragdoll_rotation).flatten(),
    };
    validate_frame(&frame)?;
    Ok(frame)
}

fn surfaces_from_state(value: i32, version: i32) -> Vec<Surface> {
    if version == 6 {
        let mut surfaces = Vec::new();
        if value & (1 << 1) != 0 {
            surfaces.push(Surface::Grass);
        }
        if value & ((1 << 2) | (1 << 3)) != 0 {
            surfaces.push(Surface::Sand);
        }
        if value & (1 << 4) != 0 {
            surfaces.push(Surface::Ice1);
        }
        if value & (1 << 5) != 0 {
            surfaces.push(Surface::Soap);
        }
        if value & ((1 << 8) | (1 << 9)) != 0 {
            surfaces.push(Surface::Mud);
        }
        if surfaces.is_empty() || value & ((1 << 0) | (1 << 6) | (1 << 7)) != 0 {
            surfaces.insert(0, Surface::Tarmac);
        }
        return surfaces;
    }
    [
        (Surface::Tarmac, 0),
        (Surface::Grass, 1),
        (Surface::Sand, 2),
        (Surface::Soap, 3),
        (Surface::Wood, 4),
        (Surface::Mud, 5),
        (Surface::Ice1, 6),
        (Surface::Ice2, 7),
        (Surface::Ice3, 8),
    ]
    .into_iter()
    .filter_map(|(surface, bit)| (value & (1 << bit) != 0).then_some(surface))
    .collect()
}

fn validate_frame(frame: &GhostFrame) -> Result<(), GhostError> {
    if !frame.time.is_finite()
        || !frame.position.x.is_finite()
        || !frame.position.y.is_finite()
        || !frame.position.z.is_finite()
        || frame.steering.is_some_and(|value| !value.is_finite())
    {
        return Err(GhostError::Invalid("frame"));
    }
    if let Some(rotation) = frame.rotation
        && (!rotation.x.is_finite() || !rotation.y.is_finite() || !rotation.z.is_finite())
    {
        return Err(GhostError::Invalid("frame rotation"));
    }
    Ok(())
}

fn detect_capabilities(frames: &[GhostFrame], version: i32) -> GhostCapabilities {
    GhostCapabilities {
        input: frames.iter().any(|frame| {
            frame.steering.is_some()
                || frame.arms_up.is_some()
                || frame.braking.is_some()
                || frame.horn.is_some()
        }),
        air: frames
            .iter()
            .any(|frame| frame.grounded_wheel_state.is_some()),
        wheels: frames
            .iter()
            .any(|frame| frame.grounded_wheel_state.is_some()),
        slipping: version >= 6
            || frames
                .iter()
                .any(|frame| frame.slipping_wheel_state.is_some()),
        state: frames.iter().any(|frame| {
            frame.soap.is_some()
                || frame.offroad.is_some()
                || frame.paraglider.is_some()
                || frame.parking_block.is_some()
                || frame.monorail.is_some()
        }),
        surfaces: frames.iter().any(|frame| !frame.surfaces.is_empty()),
        velocity: frames.iter().any(|frame| {
            frame.local_velocity.is_some()
                || frame.local_angular_velocity.is_some()
                || frame.local_g_force.is_some()
        }),
        ragdoll: version >= 6 || frames.iter().any(|frame| frame.ragdoll.is_some()),
        orientation: frames.iter().any(|frame| frame.orientation.is_some()),
    }
}

fn remap_byte(value: u32) -> f64 {
    f64::from(value.min(255)) / 255.0 * 2.0 - 1.0
}

fn vector3_float(value: &proto::Vector3) -> Vector3 {
    Vector3 {
        x: f64::from(value.x),
        y: f64::from(value.y),
        z: f64::from(value.z),
    }
}

fn unscale3(value: &proto::Vector3Int, multiplier: f64) -> Vector3 {
    Vector3 {
        x: f64::from(value.x) / multiplier,
        y: f64::from(value.y) / multiplier,
        z: f64::from(value.z) / multiplier,
    }
}

fn add3(left: Vector3, right: Vector3) -> Vector3 {
    Vector3 {
        x: left.x + right.x,
        y: left.y + right.y,
        z: left.z + right.z,
    }
}

fn normalize_quaternion(value: Quaternion) -> Quaternion {
    let magnitude =
        (value.x * value.x + value.y * value.y + value.z * value.z + value.w * value.w).sqrt();
    if !magnitude.is_finite() || magnitude <= f64::EPSILON {
        return Quaternion {
            w: 1.0,
            ..Quaternion::default()
        };
    }
    Quaternion {
        x: value.x / magnitude,
        y: value.y / magnitude,
        z: value.z / magnitude,
        w: value.w / magnitude,
    }
}

fn unity_euler_to_quaternion(rotation: Vector3) -> Quaternion {
    let x = axis_quaternion(0, rotation.x.to_radians());
    let y = axis_quaternion(1, rotation.y.to_radians());
    let z = axis_quaternion(2, rotation.z.to_radians());
    normalize_quaternion(multiply_quaternion(y, multiply_quaternion(x, z)))
}

fn axis_quaternion(axis: usize, radians: f64) -> Quaternion {
    let sine = (radians / 2.0).sin();
    let cosine = (radians / 2.0).cos();
    Quaternion {
        x: if axis == 0 { sine } else { 0.0 },
        y: if axis == 1 { sine } else { 0.0 },
        z: if axis == 2 { sine } else { 0.0 },
        w: cosine,
    }
}

fn multiply_quaternion(left: Quaternion, right: Quaternion) -> Quaternion {
    Quaternion {
        x: left.w * right.x + left.x * right.w + left.y * right.z - left.z * right.y,
        y: left.w * right.y - left.x * right.z + left.y * right.w + left.z * right.x,
        z: left.w * right.z + left.x * right.y - left.y * right.x + left.z * right.w,
        w: left.w * right.w - left.x * right.x - left.y * right.y - left.z * right.z,
    }
}

struct BinaryReader<'a> {
    bytes: &'a [u8],
    offset: usize,
}

impl<'a> BinaryReader<'a> {
    fn new(bytes: &'a [u8]) -> Self {
        Self { bytes, offset: 0 }
    }

    fn take<const N: usize>(&mut self) -> Result<[u8; N], GhostError> {
        let end = self
            .offset
            .checked_add(N)
            .ok_or(GhostError::Invalid("binary offset"))?;
        let value = self
            .bytes
            .get(self.offset..end)
            .ok_or(GhostError::Invalid("truncated binary ghost"))?
            .try_into()
            .expect("fixed-size binary slice");
        self.offset = end;
        Ok(value)
    }

    fn u8(&mut self) -> Result<u8, GhostError> {
        Ok(self.take::<1>()?[0])
    }

    fn i16(&mut self) -> Result<i16, GhostError> {
        Ok(i16::from_le_bytes(self.take()?))
    }

    fn i32(&mut self) -> Result<i32, GhostError> {
        Ok(i32::from_le_bytes(self.take()?))
    }

    fn u64(&mut self) -> Result<u64, GhostError> {
        Ok(u64::from_le_bytes(self.take()?))
    }

    fn f32(&mut self) -> Result<f32, GhostError> {
        Ok(f32::from_le_bytes(self.take()?))
    }

    fn vector3_f32(&mut self) -> Result<Vector3, GhostError> {
        Ok(Vector3 {
            x: f64::from(self.f32()?),
            y: f64::from(self.f32()?),
            z: f64::from(self.f32()?),
        })
    }
}
