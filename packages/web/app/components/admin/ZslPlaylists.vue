<script setup lang="ts">
import type { Round } from './zslTypes'
import { londonTimestamp, zslError } from './zslTypes'

const { round } = defineProps<{ round: Round }>()
interface Diagnostic {
	name?: string
	position?: number
	stage: string
	state: string
	uid?: string
	workshopId?: string
}
interface Revision {
	diagnostics: Diagnostic[]
	kind: 'practice' | 'tournament' | 'warmup'
	selectedRevision: number
	state: string
	verifiedLevels: { uid: string; name: string; workshopId: string }[]
	verifiedRevision: number | null
}
interface Readiness {
	alerts: { timeslot: number; startsAt: string; hours: number }[]
	playlists: Revision[]
	tournamentPinned: boolean
}
const endpoint = computed(() => `/api/admin/zsl/rounds/${round.id}/playlists`)
const { data, refresh, error: loadError } = useFetch<Readiness>(endpoint, { lazy: true })
const kinds = ['practice', 'warmup', 'tournament'] as const
const panels = computed(() => kinds.map((kind) => ({
	kind,
	revision: data.value?.playlists.find((playlist) => playlist.kind === kind),
})))
const files = shallowRef<Partial<Record<'practice' | 'tournament', File>>>({})
const busy = shallowRef(false)
const error = shallowRef('')
const message = shallowRef('')

function selectFile(event: Event, kind: 'practice' | 'tournament') {
	const file = (event.target as HTMLInputElement).files?.[0]
	files.value = { ...files.value, [kind]: file }
}

async function request(action: 'upload' | 'uploadPractice' | 'regenerate' | 'retry', revision?: number) {
	busy.value = true
	error.value = ''
	message.value = ''
	try {
		let source: string | undefined
		if (action === 'upload' || action === 'uploadPractice') {
			const file = files.value[action === 'uploadPractice' ? 'practice' : 'tournament']
			if (!file?.name.toLowerCase().endsWith('.zeeplist')) throw new Error('Select a .zeeplist file')
			if (file.size > 1024 * 1024) throw new Error('Playlist exceeds 1 MiB')
			source = await file.text()
		}
		await $fetch(endpoint.value, { method: 'POST', body: { action, source, revision } })
		message.value = 'Preparation queued'
		await refresh()
	} catch (failure) {
		error.value = zslError(failure)
	} finally {
		busy.value = false
	}
}
</script>

<template>
	<section class="mt-6 space-y-4 rounded border p-4" aria-labelledby="playlist-heading">
		<div class="flex items-center justify-between gap-2">
			<h2 id="playlist-heading" class="text-lg font-semibold">Playlist readiness</h2>
			<button type="button" class="rounded border px-3 py-2" :disabled="busy" @click="refresh()">Refresh status</button>
		</div>
		<p>Timeslot 1 {{ londonTimestamp(round.eventDate) }}<br>Timeslot 2 {{ londonTimestamp(round.event2Date) || 'Unscheduled' }}</p>
		<p v-if="loadError || error" role="alert">{{ error || zslError(loadError) }}</p>
		<p v-if="message" role="status">{{ message }}</p>
		<ul v-if="data?.alerts.length" class="space-y-1">
			<li v-for="alert in data.alerts" :key="`${alert.timeslot}:${alert.startsAt}:${alert.hours}`">
				Playlists unready at {{ alert.hours }}h check for Timeslot {{ alert.timeslot }} ({{ londonTimestamp(alert.startsAt) }})
			</li>
		</ul>
		<section v-for="{ kind, revision } in panels" :key="kind" class="space-y-2 border-t pt-4">
			<h3 class="font-semibold capitalize">{{ kind }}</h3>
			<p v-if="revision">{{ revision.state }} · selected #{{ revision.selectedRevision }} · verified {{ revision.verifiedRevision ? `#${revision.verifiedRevision}` : 'pending' }}</p>
			<p v-else>No admin revision</p>
			<template v-if="kind !== 'warmup'">
				<p v-if="kind === 'tournament' && data?.tournamentPinned">Tournament revision locked</p>
				<form v-else class="flex flex-wrap gap-2" @submit.prevent="request(kind === 'practice' ? 'uploadPractice' : 'upload')">
					<input type="file" accept=".zeeplist" :aria-label="kind === 'practice' ? 'Practice playlist' : 'Tournament playlist'" @change="selectFile($event, kind)">
					<button type="submit" class="rounded border px-3 py-2" :disabled="busy || !files[kind]">Upload {{ kind }} playlist</button>
				</form>
			</template>
			<button v-else type="button" class="rounded border px-3 py-2" :disabled="busy" @click="request('regenerate')">Regenerate warmup</button>
			<button v-if="revision?.state === 'failed' && (kind !== 'tournament' || !data?.tournamentPinned)"
				type="button" class="ml-2 rounded border px-3 py-2" :disabled="busy"
				@click="request('retry', revision.selectedRevision)">Retry preparation</button>
			<template v-if="revision?.verifiedLevels.length">
				<h4 class="font-medium">Verified play order</h4>
				<ol class="ml-5 list-decimal">
					<li v-for="level in revision.verifiedLevels" :key="`${level.workshopId}:${level.uid}`">{{ level.name }} · {{ level.workshopId }} · {{ level.uid }}</li>
				</ol>
			</template>
			<ul v-if="revision?.diagnostics.length" class="space-y-1 break-words text-sm">
				<li v-for="(entry, index) in revision.diagnostics" :key="index">
					<span v-if="entry.name">{{ entry.position }}. {{ entry.name }} · Workshop {{ entry.workshopId }} · {{ entry.uid }} · </span>
					{{ entry.stage }}
				</li>
			</ul>
		</section>
	</section>
</template>
