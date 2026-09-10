import type { OnlineLevel } from '@zeepkist/core/zeepnet'
import type { LevelPayloadLease } from './levelPayloadCache'

export interface PreparedLevel {
	compressedData: Uint8Array
	contentSha256: string
	lease: LevelPayloadLease
	level: OnlineLevel
}

/** Metadata-only playlist. Load acquires a lease only for a requested entry. */
export interface PreparedPlaylist {
	levels: readonly OnlineLevel[]
	load(uid: string, workshopId: bigint): Promise<PreparedLevel | undefined>
}
