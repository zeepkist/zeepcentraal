declare module 'bufferutil' {
	export function mask(
		source: Uint8Array,
		mask: Uint8Array,
		output: Uint8Array,
		offset: number,
		length: number,
	): void
	export function unmask(buffer: Uint8Array, mask: Uint8Array): void
}
