<template>
	<div class="flex flex-col gap-3 rounded-2xl border border-border bg-card/70 p-3 shadow-sm">
		<div class="flex items-center gap-3">
			<UButton
				:icon="playing ? 'i-tabler-player-pause-filled' : 'i-tabler-player-play-filled'"
				color="primary"
				:aria-label="playing ? labels.pause : labels.play"
				@click="$emit('update:playing', !playing)"
			/>
			<input
				class="ghost-timeline h-2 min-w-0 flex-1 cursor-pointer accent-primary"
				type="range"
				min="0"
				:max="duration"
				step="0.001"
				:value="currentTime"
				:aria-label="labels.timeline"
				@input="$emit('update:currentTime', Number(($event.target as HTMLInputElement).value))"
			/>
			<span class="w-28 text-right text-sm font-bold tabular-nums text-highlighted">
				{{ formatTime(currentTime) }} / {{ formatTime(duration) }}
			</span>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<UButton
				color="neutral"
				variant="soft"
				icon="i-tabler-step-into"
				:aria-label="labels.previousFrame"
				@click="$emit('step', -1)"
			/>
			<UButton
				color="neutral"
				variant="soft"
				icon="i-tabler-step-out"
				:aria-label="labels.nextFrame"
				@click="$emit('step', 1)"
			/>
			<USelect
				:model-value="playbackRate"
				:items="rateItems"
				class="w-24"
				:aria-label="labels.speed"
				@update:model-value="$emit('update:playbackRate', Number($event))"
			/>
			<UButton
				:color="loop ? 'primary' : 'neutral'"
				:variant="loop ? 'soft' : 'ghost'"
				icon="i-tabler-repeat"
				:aria-label="labels.loop"
				:aria-pressed="loop"
				@click="$emit('update:loop', !loop)"
			/>
			<div class="flex-1" />
			<UButton
				:color="cameraMode === 'orbit' ? 'primary' : 'neutral'"
				:variant="cameraMode === 'orbit' ? 'soft' : 'ghost'"
				icon="i-tabler-view-360-arrow"
				@click="$emit('update:cameraMode', 'orbit')"
			>
				{{ labels.orbit }}
			</UButton>
			<UButton
				:color="cameraMode === 'isometric' ? 'primary' : 'neutral'"
				:variant="cameraMode === 'isometric' ? 'soft' : 'ghost'"
				icon="i-tabler-axis-x"
				@click="$emit('update:cameraMode', 'isometric')"
			>
				{{ labels.isometric }}
			</UButton>
			<UButton
				color="neutral"
				variant="soft"
				icon="i-tabler-focus-centered"
				@click="$emit('follow')"
			>
				{{ labels.follow }}
			</UButton>
			<UButton
				color="neutral"
				variant="soft"
				icon="i-tabler-arrows-maximize"
				@click="$emit('frameRoute')"
			>
				{{ labels.frameRoute }}
			</UButton>
			<UButton
				color="neutral"
				variant="soft"
				:icon="fullscreen ? 'i-tabler-arrows-minimize' : 'i-tabler-arrows-maximize'"
				:aria-label="fullscreen ? labels.exitFullScreen : labels.fullScreen"
				:aria-pressed="fullscreen"
				@click="$emit('fullscreen')"
			/>
			<slot name="settings" />
		</div>
	</div>
</template>

<script setup vapor lang="ts">
import type { GhostCameraMode } from '~/types/ghost'

const props = defineProps<{
	currentTime: number
	duration: number
	playing: boolean
	playbackRate: number
	loop: boolean
	cameraMode: GhostCameraMode
	fullscreen: boolean
	labels: {
		play: string
		pause: string
		timeline: string
		previousFrame: string
		nextFrame: string
		speed: string
		loop: string
		orbit: string
		isometric: string
		follow: string
		frameRoute: string
		fullScreen: string
		exitFullScreen: string
	}
}>()

defineEmits<{
	'update:currentTime': [value: number]
	'update:playing': [value: boolean]
	'update:playbackRate': [value: number]
	'update:loop': [value: boolean]
	'update:cameraMode': [value: GhostCameraMode]
	step: [direction: -1 | 1]
	follow: []
	frameRoute: []
	fullscreen: []
}>()

const rateItems = [0.25, 0.5, 1, 2].map((value) => ({ label: `${value}×`, value }))

function formatTime(seconds: number) {
	const safe = Math.max(0, seconds)
	const minutes = Math.floor(safe / 60)
	return `${minutes}:${(safe - minutes * 60).toFixed(3).padStart(6, '0')}`
}
</script>
