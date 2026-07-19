import type { Quaternion, Vector3 } from './types'

const DEGREES_TO_RADIANS = Math.PI / 180

/** Converts Unity's Z-X-Y Euler application order into a normalized quaternion. */
export function unityEulerToQuaternion(rotation: Vector3): Quaternion {
	const x = axisQuaternion('x', rotation.x * DEGREES_TO_RADIANS)
	const y = axisQuaternion('y', rotation.y * DEGREES_TO_RADIANS)
	const z = axisQuaternion('z', rotation.z * DEGREES_TO_RADIANS)
	return normalizeQuaternion(multiplyQuaternion(y, multiplyQuaternion(x, z)))
}

export function normalizeQuaternion(value: Quaternion): Quaternion {
	const magnitude = Math.hypot(value.x, value.y, value.z, value.w)
	if (!Number.isFinite(magnitude) || magnitude <= Number.EPSILON) {
		return { x: 0, y: 0, z: 0, w: 1 }
	}
	return {
		x: value.x / magnitude,
		y: value.y / magnitude,
		z: value.z / magnitude,
		w: value.w / magnitude,
	}
}

function axisQuaternion(axis: 'x' | 'y' | 'z', radians: number): Quaternion {
	const sine = Math.sin(radians / 2)
	const cosine = Math.cos(radians / 2)
	return {
		x: axis === 'x' ? sine : 0,
		y: axis === 'y' ? sine : 0,
		z: axis === 'z' ? sine : 0,
		w: cosine,
	}
}

function multiplyQuaternion(left: Quaternion, right: Quaternion): Quaternion {
	return {
		x: left.w * right.x + left.x * right.w + left.y * right.z - left.z * right.y,
		y: left.w * right.y - left.x * right.z + left.y * right.w + left.z * right.x,
		z: left.w * right.z + left.x * right.y - left.y * right.x + left.z * right.w,
		w: left.w * right.w - left.x * right.x - left.y * right.y - left.z * right.z,
	}
}
