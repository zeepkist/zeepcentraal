use super::types::{GhostFrame, GhostStatistics, Surface, Vector2, Vector3};

const SPEED_CAP_KMH: f64 = 500.0;
const TURN_DEADZONE: f64 = 0.1;

#[derive(Default)]
struct SurfaceValues([f64; 9]);

impl SurfaceValues {
    fn add(&mut self, surfaces: &[Surface], value: f64) {
        if surfaces.is_empty() {
            return;
        }
        let value = value / surfaces.len() as f64;
        for surface in surfaces {
            self.0[surface_index(*surface)] += value;
        }
    }

    fn get(&self, surface: Surface) -> f64 {
        self.0[surface_index(surface)]
    }
}

fn surface_index(surface: Surface) -> usize {
    match surface {
        Surface::Tarmac => 0,
        Surface::Grass => 1,
        Surface::Sand => 2,
        Surface::Soap => 3,
        Surface::Wood => 4,
        Surface::Mud => 5,
        Surface::Ice1 => 6,
        Surface::Ice2 => 7,
        Surface::Ice3 => 8,
    }
}

pub fn calculate_ghost_statistics(frames: &[GhostFrame], version: i32) -> GhostStatistics {
    if frames.is_empty() {
        return GhostStatistics {
            ghost_version: Some(version),
            frame_count: Some(0),
            ..GhostStatistics::default()
        };
    }

    let mut total_distance = 0.0;
    let mut distance_in_air = 0.0;
    let mut distance_on_ground = 0.0;
    let mut distance_on_wheels = [0.0; 5];
    let mut distance_slipping = 0.0;
    let mut distance_paraglider = 0.0;
    let mut distance_offroad_wheels = 0.0;
    let mut distance_soap_wheels = 0.0;
    let mut distance_on_monorail = 0.0;
    let mut distance_parked = 0.0;
    let mut distance_ragdoll = 0.0;
    let mut surface_distance = SurfaceValues::default();
    let mut surface_time = SurfaceValues::default();

    let mut speed_time = 0.0;
    let mut speed_weighted = 0.0;
    let mut max_speed = None;
    let mut velocity_time = 0.0;
    let mut velocity_weighted = 0.0;
    let mut max_velocity = None;
    let mut angular_velocity_time = 0.0;
    let mut angular_velocity_weighted = 0.0;
    let mut max_angular_velocity = None;
    let mut gforce_time = 0.0;
    let mut gforce_weighted = 0.0;
    let mut max_gforce = None;

    let mut arms_up_count = 0;
    let mut arms_up_time = 0.0;
    let mut brake_count = 0;
    let mut brake_time = 0.0;
    let mut turn_left_count = 0;
    let mut turn_left_time = 0.0;
    let mut turn_right_count = 0;
    let mut turn_right_time = 0.0;
    let mut horn_count = 0;
    let mut horn_time = 0.0;
    let mut time_any_driver_input = 0.0;
    let mut time_in_air = 0.0;
    let mut time_on_ground = 0.0;
    let mut time_on_wheels = [0.0; 5];
    let mut time_slipping = 0.0;
    let mut time_paraglider = 0.0;
    let mut time_offroad_wheels = 0.0;
    let mut time_soap_wheels = 0.0;
    let mut time_on_monorail = 0.0;
    let mut time_parked = 0.0;
    let mut time_ragdoll = 0.0;

    let mut has_input = false;
    let mut has_horn = false;
    let mut has_state = false;
    let mut has_air = false;
    let mut has_wheels = false;
    let mut has_slip = version >= 6;
    let mut has_surface = false;
    let mut has_parking = false;
    let mut has_monorail = false;
    let mut has_ragdoll = version >= 6;
    let mut has_velocity = false;

    let mut previous: Option<&GhostFrame> = None;
    for frame in frames {
        has_input |= frame.steering.is_some() || frame.arms_up.is_some() || frame.braking.is_some();
        has_horn |= frame.horn.is_some();
        has_state |= frame.soap.is_some() || frame.offroad.is_some() || frame.paraglider.is_some();
        has_air |= frame.grounded_wheel_state.is_some();
        has_wheels |= frame.grounded_wheel_state.is_some();
        has_slip |= frame.slipping_wheel_state.is_some();
        has_surface |= !frame.surfaces.is_empty();
        has_parking |= frame.parking_block.is_some();
        has_monorail |= frame.monorail.is_some();
        has_ragdoll |= frame.ragdoll.is_some();
        has_velocity |= frame.local_velocity.is_some()
            || frame.local_angular_velocity.is_some()
            || frame.local_g_force.is_some();

        if let Some(speed) = frame.speed.filter(|value| value.is_finite()) {
            max_speed = max_option(max_speed, speed.min(SPEED_CAP_KMH));
        }
        if let Some(value) = frame
            .local_velocity
            .map(magnitude3)
            .filter(|v| v.is_finite())
        {
            max_velocity = max_option(max_velocity, value);
        }
        if let Some(value) = frame
            .local_angular_velocity
            .map(magnitude3)
            .filter(|v| v.is_finite())
        {
            max_angular_velocity = max_option(max_angular_velocity, value);
        }
        if let Some(value) = frame
            .local_g_force
            .map(magnitude2)
            .filter(|v| v.is_finite())
        {
            max_gforce = max_option(max_gforce, value);
        }

        arms_up_count = add_transition(
            frame.arms_up,
            previous.and_then(|v| v.arms_up),
            arms_up_count,
        );
        brake_count = add_transition(frame.braking, previous.and_then(|v| v.braking), brake_count);
        horn_count = add_transition(frame.horn, previous.and_then(|v| v.horn), horn_count);
        let turn_left = frame.steering.is_some_and(|value| value < -TURN_DEADZONE);
        let was_turn_left = previous
            .and_then(|value| value.steering)
            .is_some_and(|value| value < -TURN_DEADZONE);
        let turn_right = frame.steering.is_some_and(|value| value > TURN_DEADZONE);
        let was_turn_right = previous
            .and_then(|value| value.steering)
            .is_some_and(|value| value > TURN_DEADZONE);
        turn_left_count = add_transition(Some(turn_left), Some(was_turn_left), turn_left_count);
        turn_right_count = add_transition(Some(turn_right), Some(was_turn_right), turn_right_count);

        let Some(previous_frame) = previous else {
            previous = Some(frame);
            continue;
        };
        let dt = frame.time - previous_frame.time;
        if !dt.is_finite() || dt <= 0.0 {
            previous = Some(frame);
            continue;
        }

        let segment_distance = distance(previous_frame.position, frame.position);
        let implied_speed = segment_distance / dt * 3.6;
        let valid_segment = segment_distance.is_finite()
            && implied_speed.is_finite()
            && implied_speed <= SPEED_CAP_KMH;
        if valid_segment {
            total_distance += segment_distance;
            if previous_frame.grounded_wheel_state == Some(0) {
                distance_in_air += segment_distance;
            } else if previous_frame.grounded_wheel_state.is_some() {
                distance_on_ground += segment_distance;
            }
            if let Some(wheels) = wheel_count(previous_frame.grounded_wheel_state) {
                distance_on_wheels[wheels] += segment_distance;
            }
            if previous_frame.slipping_wheel_state.unwrap_or_default() != 0 {
                distance_slipping += segment_distance;
            }
            if previous_frame.paraglider == Some(true) {
                distance_paraglider += segment_distance;
            }
            if previous_frame.offroad == Some(true) {
                distance_offroad_wheels += segment_distance;
            }
            if previous_frame.soap == Some(true) {
                distance_soap_wheels += segment_distance;
            }
            if previous_frame.monorail == Some(true) {
                distance_on_monorail += segment_distance;
            }
            if previous_frame.parking_block == Some(true) {
                distance_parked += segment_distance;
            }
            surface_distance.add(&previous_frame.surfaces, segment_distance);
        }
        if previous_frame.ragdoll == Some(true) {
            let ragdoll_distance = distance(
                previous_frame
                    .ragdoll_position
                    .unwrap_or(previous_frame.position),
                frame.ragdoll_position.unwrap_or(frame.position),
            );
            let ragdoll_speed = ragdoll_distance / dt * 3.6;
            if ragdoll_distance.is_finite()
                && ragdoll_speed.is_finite()
                && ragdoll_speed <= SPEED_CAP_KMH
            {
                distance_ragdoll += ragdoll_distance;
            }
        }

        let speed = previous_frame.speed.unwrap_or(implied_speed);
        if speed.is_finite() {
            speed_time += dt;
            speed_weighted += speed.min(SPEED_CAP_KMH) * dt;
            max_speed = max_option(max_speed, speed.min(SPEED_CAP_KMH));
        }
        if let Some(value) = previous_frame
            .local_velocity
            .map(magnitude3)
            .filter(|v| v.is_finite())
        {
            velocity_time += dt;
            velocity_weighted += value * dt;
            max_velocity = max_option(max_velocity, value);
        }
        if let Some(value) = previous_frame
            .local_angular_velocity
            .map(magnitude3)
            .filter(|v| v.is_finite())
        {
            angular_velocity_time += dt;
            angular_velocity_weighted += value * dt;
            max_angular_velocity = max_option(max_angular_velocity, value);
        }
        if let Some(value) = previous_frame
            .local_g_force
            .map(magnitude2)
            .filter(|v| v.is_finite())
        {
            gforce_time += dt;
            gforce_weighted += value * dt;
            max_gforce = max_option(max_gforce, value);
        }

        if previous_frame.arms_up == Some(true) {
            arms_up_time += dt;
        }
        if previous_frame.braking == Some(true) {
            brake_time += dt;
        }
        if previous_frame.horn == Some(true) {
            horn_time += dt;
        }
        if any_driver_input(previous_frame) {
            time_any_driver_input += dt;
        }
        if previous_frame
            .steering
            .is_some_and(|value| value < -TURN_DEADZONE)
        {
            turn_left_time += dt;
        }
        if previous_frame
            .steering
            .is_some_and(|value| value > TURN_DEADZONE)
        {
            turn_right_time += dt;
        }
        if previous_frame.grounded_wheel_state == Some(0) {
            time_in_air += dt;
        } else if previous_frame.grounded_wheel_state.is_some() {
            time_on_ground += dt;
        }
        if let Some(wheels) = wheel_count(previous_frame.grounded_wheel_state) {
            time_on_wheels[wheels] += dt;
        }
        if previous_frame.slipping_wheel_state.unwrap_or_default() != 0 {
            time_slipping += dt;
        }
        if previous_frame.paraglider == Some(true) {
            time_paraglider += dt;
        }
        if previous_frame.offroad == Some(true) {
            time_offroad_wheels += dt;
        }
        if previous_frame.soap == Some(true) {
            time_soap_wheels += dt;
        }
        if previous_frame.monorail == Some(true) {
            time_on_monorail += dt;
        }
        if previous_frame.parking_block == Some(true) {
            time_parked += dt;
        }
        if previous_frame.ragdoll == Some(true) {
            time_ragdoll += dt;
        }
        surface_time.add(&previous_frame.surfaces, dt);
        previous = Some(frame);
    }

    let duration = frames
        .last()
        .map(|frame| frame.time)
        .filter(|v| v.is_finite());
    GhostStatistics {
        ghost_version: Some(version),
        has_input_data: has_input,
        has_air_data: has_air,
        has_wheel_data: has_wheels,
        has_slip_data: has_slip,
        has_state_data: has_state,
        has_surface_data: has_surface,
        has_velocity_data: has_velocity,
        has_ragdoll_data: has_ragdoll,
        frame_count: Some(frames.len() as i32),
        time: duration,
        distance: Some(total_distance),
        distance_in_air: has_air.then_some(distance_in_air),
        distance_on_ground: has_air.then_some(distance_on_ground),
        distance_on_1_wheel: has_wheels.then_some(distance_on_wheels[1]),
        distance_on_2_wheels: has_wheels.then_some(distance_on_wheels[2]),
        distance_on_3_wheels: has_wheels.then_some(distance_on_wheels[3]),
        distance_on_4_wheels: has_wheels.then_some(distance_on_wheels[4]),
        time_in_air: has_air.then_some(time_in_air),
        time_on_ground: has_air.then_some(time_on_ground),
        time_on_1_wheel: has_wheels.then_some(time_on_wheels[1]),
        time_on_2_wheels: has_wheels.then_some(time_on_wheels[2]),
        time_on_3_wheels: has_wheels.then_some(time_on_wheels[3]),
        time_on_4_wheels: has_wheels.then_some(time_on_wheels[4]),
        average_speed: (speed_time > 0.0).then_some(speed_weighted / speed_time),
        max_speed,
        arms_up_count: has_input.then_some(arms_up_count),
        arms_up_time: has_input.then_some(arms_up_time),
        brake_count: has_input.then_some(brake_count),
        brake_time: has_input.then_some(brake_time),
        turn_left_count: has_input.then_some(turn_left_count),
        turn_left_time: has_input.then_some(turn_left_time),
        turn_right_count: has_input.then_some(turn_right_count),
        turn_right_time: has_input.then_some(turn_right_time),
        horn_count: has_horn.then_some(horn_count),
        horn_time: has_horn.then_some(horn_time),
        distance_slipping: has_slip.then_some(distance_slipping),
        distance_paraglider: has_state.then_some(distance_paraglider),
        distance_offroad_wheels: has_state.then_some(distance_offroad_wheels),
        distance_soap_wheels: has_state.then_some(distance_soap_wheels),
        distance_on_monorail: has_monorail.then_some(distance_on_monorail),
        distance_parked: has_parking.then_some(distance_parked),
        distance_ragdoll: has_ragdoll.then_some(distance_ragdoll),
        time_slipping: has_slip.then_some(time_slipping),
        time_paraglider: has_state.then_some(time_paraglider),
        time_offroad_wheels: has_state.then_some(time_offroad_wheels),
        time_soap_wheels: has_state.then_some(time_soap_wheels),
        time_on_monorail: has_monorail.then_some(time_on_monorail),
        time_parked: has_parking.then_some(time_parked),
        time_ragdoll: has_ragdoll.then_some(time_ragdoll),
        distance_on_tarmac: has_surface.then_some(surface_distance.get(Surface::Tarmac)),
        distance_on_grass: has_surface.then_some(surface_distance.get(Surface::Grass)),
        distance_on_sand: has_surface.then_some(surface_distance.get(Surface::Sand)),
        distance_on_soap: has_surface.then_some(surface_distance.get(Surface::Soap)),
        distance_on_wood: has_surface.then_some(surface_distance.get(Surface::Wood)),
        distance_on_mud: has_surface.then_some(surface_distance.get(Surface::Mud)),
        distance_on_ice1: has_surface.then_some(surface_distance.get(Surface::Ice1)),
        distance_on_ice2: has_surface.then_some(surface_distance.get(Surface::Ice2)),
        distance_on_ice3: has_surface.then_some(surface_distance.get(Surface::Ice3)),
        time_on_tarmac: has_surface.then_some(surface_time.get(Surface::Tarmac)),
        time_on_grass: has_surface.then_some(surface_time.get(Surface::Grass)),
        time_on_sand: has_surface.then_some(surface_time.get(Surface::Sand)),
        time_on_soap: has_surface.then_some(surface_time.get(Surface::Soap)),
        time_on_wood: has_surface.then_some(surface_time.get(Surface::Wood)),
        time_on_mud: has_surface.then_some(surface_time.get(Surface::Mud)),
        time_on_ice1: has_surface.then_some(surface_time.get(Surface::Ice1)),
        time_on_ice2: has_surface.then_some(surface_time.get(Surface::Ice2)),
        time_on_ice3: has_surface.then_some(surface_time.get(Surface::Ice3)),
        average_velocity: (velocity_time > 0.0).then_some(velocity_weighted / velocity_time),
        max_velocity,
        average_angular_velocity: (angular_velocity_time > 0.0)
            .then_some(angular_velocity_weighted / angular_velocity_time),
        max_angular_velocity,
        average_gforce: (gforce_time > 0.0).then_some(gforce_weighted / gforce_time),
        max_gforce,
        time_any_driver_input: has_input.then_some(time_any_driver_input),
        driver_input_transition_count: has_input
            .then_some(arms_up_count + brake_count + turn_left_count + turn_right_count),
    }
}

fn add_transition(active: Option<bool>, was_active: Option<bool>, count: i32) -> i32 {
    count + i32::from(active == Some(true) && was_active != Some(true))
}

fn any_driver_input(frame: &GhostFrame) -> bool {
    frame.arms_up == Some(true)
        || frame.braking == Some(true)
        || frame
            .steering
            .is_some_and(|value| value.abs() > TURN_DEADZONE)
}

fn wheel_count(value: Option<i32>) -> Option<usize> {
    let value = value?;
    if value <= 0 {
        return None;
    }
    match value.count_ones() as usize {
        count @ 1..=4 => Some(count),
        _ => None,
    }
}

fn distance(left: Vector3, right: Vector3) -> f64 {
    let x = left.x - right.x;
    let y = left.y - right.y;
    let z = left.z - right.z;
    (x * x + y * y + z * z).sqrt()
}

fn magnitude3(value: Vector3) -> f64 {
    (value.x * value.x + value.y * value.y + value.z * value.z).sqrt()
}

fn magnitude2(value: Vector2) -> f64 {
    (value.x * value.x + value.y * value.y).sqrt()
}

fn max_option(current: Option<f64>, value: f64) -> Option<f64> {
    Some(current.map_or(value, |current| current.max(value)))
}
