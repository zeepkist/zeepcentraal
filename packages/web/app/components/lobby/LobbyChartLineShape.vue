<script setup lang="ts">
import { Curve, type Point } from 'vccs'
import { lobbyGapPath } from '~/utils/lobbyChart'

const props = defineProps<{ points: readonly Point[]; stroke: string; step?: boolean }>()
const gapPath = computed(() => lobbyGapPath(props.points))
</script>

<template>
	<g>
		<Curve
			class="v-charts-line-curve"
			:points="points"
			:type="step ? 'stepAfter' : 'linear'"
			:connect-nulls="false"
			:stroke="stroke"
			:stroke-width="2"
			fill="none"
		/>
		<path
			v-if="gapPath"
			class="lobby-chart-gap"
			:d="gapPath"
			:stroke="stroke"
			stroke-width="2"
			stroke-dasharray="2 4"
			fill="none"
			pointer-events="none"
		/>
	</g>
</template>
