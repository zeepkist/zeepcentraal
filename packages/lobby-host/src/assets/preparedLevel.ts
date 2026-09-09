import type { OnlineLevel } from '@zeepkist/core/zeepnet'
import type { LevelPayloadLease } from './levelPayloadCache'

export interface PreparedLevel {
	compressedData: Uint8Array
	contentSha256: string
	lease: LevelPayloadLease
	level: OnlineLevel
}
