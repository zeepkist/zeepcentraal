export function distance(
	a: { x: number; y: number; z: number },
	b: { x: number; y: number; z: number },
): number {
	const dx = a.x - b.x
	const dy = a.y - b.y
	const dz = a.z - b.z
	return Math.sqrt(dx * dx + dy * dy + dz * dz)
}
