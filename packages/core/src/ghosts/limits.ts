export const MAX_GHOST_COMPRESSED_BYTES = 24 * 1024 * 1024
export const MAX_GHOST_DECOMPRESSED_BYTES = 64 * 1024 * 1024
export const MAX_GHOST_FRAMES = 120_000

export class GhostLimitError extends Error {
	public constructor(
		message: string,
		public readonly limit: 'compressed-bytes' | 'decompressed-bytes' | 'frames',
	) {
		super(message)
		this.name = 'GhostLimitError'
	}
}

export function assertGhostCompressedSize(byteLength: number): void {
	if (byteLength > MAX_GHOST_COMPRESSED_BYTES) {
		throw new GhostLimitError(
			`Ghost exceeds ${MAX_GHOST_COMPRESSED_BYTES} compressed bytes`,
			'compressed-bytes',
		)
	}
}

export function assertGhostDecompressedSize(byteLength: number): void {
	if (byteLength > MAX_GHOST_DECOMPRESSED_BYTES) {
		throw new GhostLimitError(
			`Ghost exceeds ${MAX_GHOST_DECOMPRESSED_BYTES} decompressed bytes`,
			'decompressed-bytes',
		)
	}
}

export function assertGhostFrameCount(frameCount: number): void {
	if (!Number.isSafeInteger(frameCount) || frameCount < 0 || frameCount > MAX_GHOST_FRAMES) {
		throw new GhostLimitError(`Ghost exceeds ${MAX_GHOST_FRAMES} frames`, 'frames')
	}
}
