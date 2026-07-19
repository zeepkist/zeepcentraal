import type { GhostRecordSource } from '~/types/ghost'

export const LEVEL_GHOST_PRESET_COUNTS = [3, 5, 10, 25, 50, 100, 200] as const

export type LevelGhostPresetCount = (typeof LEVEL_GHOST_PRESET_COUNTS)[number]

export type LevelGhostPresetKind = 'personal-bests' | 'global-records' | 'viewer-records'

export type LevelGhostSearchUser = {
	id: number
	steamId: string | null
	name: string
	personalBest: GhostRecordSource
}
