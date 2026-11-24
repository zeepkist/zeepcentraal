<script setup lang="ts">
import type { ParsedPlaybackGhost } from '~/types/ghost'
import type { LevelSplitAnalysis, LevelSplitSeries } from '~/utils/levelSplitAnalysis'
import { createRecordAnalysisLabels } from '~/utils/recordAnalysisLabels'

const { t } = useAppI18n()
const dates = ['2026-11-01', '2026-11-02']
const levelHistory = dates.map((date, index) => ({ date, points: 4000 + index * 200 }))
const careerHistory = dates.map((date, index) => ({ date, rankedPoints: 61_450 + index * 5960, rank: 17 - index * 16 }))
const secondaryHistory = dates.map((date, index) => ({ date, totalPoints: 620_000 + index * 10_230_000, worldRecords: 12 + index * 8 }))
const careerLabels = {
	rankedPoints: 'Ranked points',
	rankedPointsDescription: '',
	totalPoints: 'Total points',
	totalPointsDescription: '',
	rank: 'Rank',
	rankDescription: '',
	worldRecords: 'World records',
	worldRecordsDescription: '',
	pointsToggleLabel: 'Career points series',
	standingToggleLabel: 'Career standing series',
	loading: 'Loading',
}
const lobbySeries = [
	{ key: 'players', label: 'Players', color: '#38bdf8' },
	{ key: 'capacity', label: 'Capacity', color: '#facc15' },
]
const lobbyPoints = [
	{ time: 1793520000000, players: 5, capacity: 20 },
	{ time: 1793520001000, players: null, capacity: null },
	{ time: 1793520002000, players: 8, capacity: 20 },
]
const showViewer = ref(false)
const splitSeries: LevelSplitSeries = {
	key: 'first', recordId: 1, userName: 'First', time: 5, color: '#38bdf8',
	viewer: false, viewerComparison: false, deltas: [-0.207, 0.2], speeds: [10, 12],
}
const splits: LevelSplitAnalysis = {
	checkpointCount: 1,
	series: [splitSeries, {
		key: 'viewer', recordId: 2, userName: 'Viewer', time: 6, color: '#facc15',
		viewer: true, viewerComparison: true, deltas: [0.1, 0.306], speeds: [16, 18],
	}],
	deltaData: [
		{ checkpoint: 1, first: -0.207, viewer: 0.1 },
		{ checkpoint: 2, first: 0.2, viewer: 0.306 },
	],
	speedData: [{ checkpoint: 1, first: 10, viewer: 16 }, { checkpoint: 2, first: 12, viewer: 18 }],
}
const splitLabels = {
	checkpoint: t('levels.detail.splitAnalysis.checkpoint'), finish: t('common.finish'), deltaTitle: 'Split delta', deltaDescription: '',
	speedTitle: 'Split speed', speedDescription: '', millisecondsUnit: 'ms', speedUnit: 'km/h',
}
const ghost: ParsedPlaybackGhost = {
	version: 7,
	metadata: { steamId: null, taggedUsername: null, color: null, cosmetics: null },
	capabilities: {
		inputs: true, air: false, wheels: false, slip: false, state: false,
		surfaces: false, velocity: false, ragdoll: false, orientation: false,
	},
	frames: [
		{ time: 0, position: { x: 0, y: 0, z: 0 }, speed: 7.5, steering: -0.2 },
		{ time: 1, position: { x: 1, y: 0, z: 0 }, speed: 8, steering: 0.4 },
	],
}
const telemetry = createRecordAnalysisLabels((key) => key.split('.').at(-1) ?? key).telemetry
</script>

<template>
	<UContainer class="space-y-4 py-4">
		<section aria-label="Level points history">
			<LevelPointsInsights :history="levelHistory" series-label="Level points" />
		</section>
		<section aria-label="Career history">
			<UserCareerHistory
				:history="careerHistory"
				:secondary-history="secondaryHistory"
				:secondary-pending="false"
				:secondary-ready="true"
				:labels="careerLabels"
			/>
		</section>
		<LobbyChart title="Lobby activity" :points="lobbyPoints" :series="lobbySeries" />
		<button type="button" @click="showViewer = !showViewer">Toggle viewer comparison</button>
		<section aria-label="Split charts">
			<LevelSplitAnalysis :analysis="splits" :show-viewer-comparison="showViewer" :labels="splitLabels" />
		</section>
		<section aria-label="Record telemetry">
			<RecordTelemetryCharts :ghost="ghost" :comparisons="[]" :labels="telemetry" />
		</section>
	</UContainer>
</template>
