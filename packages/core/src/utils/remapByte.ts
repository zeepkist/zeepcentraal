export function remapByte(value: number, min: number, max: number): number {
	return min + (Math.max(0, Math.min(255, value)) / 255) * (max - min)
}
