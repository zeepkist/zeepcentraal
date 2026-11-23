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
const { data, refresh, pending, error: loadError } = useFetch<Readiness>(endpoint, { lazy: true })
const kinds = ['practice', 'warmup', 'tournament'] as const
const panels = computed(() => kinds.map((kind) => ({
	kind,
	revision: data.value?.playlists.find((playlist) => playlist.kind === kind),
})))
const files = shallowRef<Partial<Record<'practice' | 'tournament', File>>>({})
const busy = shallowRef(false)
const error = shallowRef('')
const message = shallowRef('')

function stateColor(state: string) {
	switch (state) {
		case 'verified': return 'success'
		case 'prepared': return 'info'
		case 'failed': return 'error'
		case 'queued':
		case 'preparing': return 'warning'
		default: return 'neutral'
	}
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
	<section class="min-w-0 space-y-4" aria-labelledby="playlist-heading">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<h2 id="playlist-heading" class="text-xl font-semibold text-highlighted">Playlist readiness</h2>
				<dl class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
					<div class="flex flex-wrap gap-x-1.5">
						<dt>Timeslot 1</dt><dd class="text-highlighted">{{ londonTimestamp(round.eventDate) }}</dd>
					</div>
					<div class="flex flex-wrap gap-x-1.5">
						<dt>Timeslot 2</dt><dd class="text-highlighted">{{ londonTimestamp(round.event2Date) || 'Unscheduled' }}</dd>
					</div>
				</dl>
			</div>
			<UButton color="neutral" variant="outline" icon="i-tabler-refresh" :loading="pending" :disabled="busy" @click="refresh()">Refresh status</UButton>
		</div>
		<UAlert v-if="loadError || error" color="error" variant="soft" title="Playlist unavailable" :description="error || zslError(loadError)" role="alert" />
		<UAlert v-if="message" color="success" variant="soft" :title="message" role="status" />
		<UAlert v-if="data?.alerts.length" color="warning" variant="soft" title="Playlist readiness alerts">
			<template #description>
				<ul class="space-y-1">
					<li v-for="alert in data.alerts" :key="`${alert.timeslot}:${alert.startsAt}:${alert.hours}`">
						Playlists unready at {{ alert.hours }}h check for Timeslot {{ alert.timeslot }} ({{ londonTimestamp(alert.startsAt) }})
					</li>
				</ul>
			</template>
		</UAlert>
		<div class="space-y-3">
			<UCard v-for="{ kind, revision } in panels" :key="kind" class="min-w-0 rounded-2xl border-border/80 bg-card/90">
				<template #header>
					<div class="flex flex-wrap items-center justify-between gap-2">
						<h3 class="font-semibold text-highlighted capitalize">{{ kind }}</h3>
						<UBadge v-if="revision" :color="stateColor(revision.state)" variant="soft" class="capitalize">{{ revision.state }}</UBadge>
						<UBadge v-else-if="!pending && !loadError" color="neutral" variant="soft">No admin revision</UBadge>
					</div>
				</template>
				<div class="space-y-4">
					<p v-if="revision" class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
						<span>Selected #{{ revision.selectedRevision }}</span>
						<span>Verified {{ revision.verifiedRevision ? `#${revision.verifiedRevision}` : 'pending' }}</span>
					</p>
					<template v-if="kind !== 'warmup'">
						<UAlert v-if="kind === 'tournament' && data?.tournamentPinned" color="neutral" variant="soft" title="Tournament revision locked" />
						<form v-else class="space-y-3" @submit.prevent="request(kind === 'practice' ? 'uploadPractice' : 'upload')">
							<UFileUpload
								:model-value="files[kind]"
								:label="`Choose ${kind} playlist`"
								description=".zeeplist, up to 1 MiB"
								layout="list"
								size="sm"
								accept=".zeeplist"
								:disabled="busy"
								:ui="{ base: 'min-h-20', fileName: 'truncate' }"
								@update:model-value="files = { ...files, [kind]: $event }"
							/>
							<UButton type="submit" :disabled="busy || !files[kind]">Upload {{ kind }} playlist</UButton>
						</form>
					</template>
					<UButton v-else color="neutral" variant="outline" :disabled="busy" @click="request('regenerate')">Regenerate warmup</UButton>
					<UButton
						v-if="revision?.state === 'failed' && (kind !== 'tournament' || !data?.tournamentPinned)"
						color="neutral"
						variant="outline"
						:disabled="busy"
						@click="request('retry', revision.selectedRevision)"
					>
						Retry preparation
					</UButton>
					<div v-if="revision?.verifiedLevels.length" class="space-y-2">
						<h4 class="text-sm font-medium text-highlighted">Verified play order</h4>
						<ol class="ms-5 list-decimal space-y-1 text-sm text-muted">
							<li v-for="(level, index) in revision.verifiedLevels" :key="`${level.workshopId}:${level.uid}:${index}`" class="break-words">
								{{ level.name }} · {{ level.workshopId }} · {{ level.uid }}
							</li>
						</ol>
					</div>
					<div v-if="revision?.diagnostics.length" class="space-y-2">
						<h4 class="text-sm font-medium text-highlighted">Preparation diagnostics</h4>
						<ul class="space-y-1 break-words text-sm text-muted">
							<li v-for="(entry, index) in revision.diagnostics" :key="index">
								<span v-if="entry.name">{{ entry.position }}. {{ entry.name }} · Workshop {{ entry.workshopId }} · {{ entry.uid }} · </span>
								{{ entry.stage }}
							</li>
						</ul>
					</div>
				</div>
			</UCard>
		</div>
	</section>
</template>
