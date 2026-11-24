<script setup lang="ts">
import ZslPlaylistLevelRows from './ZslPlaylistLevelRows.vue'
import type { Round, ZslPlaylistLevel } from './zslTypes'
import { londonTimestamp, playlistLevelStates, zslError } from './zslTypes'

const { round } = defineProps<{ round: Round }>()
interface Revision {
	kind: 'practice' | 'tournament' | 'warmup'
	levels: ZslPlaylistLevel[]
	pendingCandidates: ZslPlaylistLevel[]
	playlistErrors: string[]
	rejectedCandidates: ZslPlaylistLevel[]
	selectedRevision: number
	state: string
	verifiedLevels: ZslPlaylistLevel[]
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
const panels = computed(() => kinds.map((kind) => {
	const revision = data.value?.playlists.find((playlist) => playlist.kind === kind)
	const counts = { ready: 0, pending: 0, failed: 0 }
	for (const level of revision?.levels ?? []) counts[level.state] += 1
	return { kind, revision, counts }
}))
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
			<UCard v-for="{ kind, revision, counts } in panels" :key="kind" class="min-w-0 rounded-2xl border-border/80 bg-card/90">
				<template #header>
					<div class="flex flex-wrap items-center justify-between gap-2">
						<h3 class="font-semibold text-highlighted capitalize">{{ kind }}</h3>
						<UBadge v-if="revision" :color="stateColor(revision.state)" variant="soft" class="capitalize">{{ revision.state }}</UBadge>
						<UBadge v-else-if="!pending && !loadError" color="neutral" variant="soft">No admin revision</UBadge>
					</div>
					<div v-if="revision" class="mt-2 flex flex-wrap gap-2">
						<span class="sr-only">Selected level counts</span>
						<UBadge v-for="(status, state) in playlistLevelStates" :key="state" :color="status.color" :icon="status.icon" variant="soft" size="sm">
							{{ counts[state] }} {{ status.label }}
						</UBadge>
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
					<template v-if="revision">
						<UAlert v-if="revision.playlistErrors.length" color="error" variant="soft" title="Playlist errors" icon="i-tabler-alert-circle">
							<template #description>
								<ul class="space-y-1">
									<li v-for="reason in revision.playlistErrors" :key="reason" class="wrap-anywhere">{{ reason }}</li>
								</ul>
							</template>
						</UAlert>
						<section class="space-y-2" :aria-labelledby="`${kind}-selected-levels`">
							<h4 :id="`${kind}-selected-levels`" class="text-sm font-semibold text-highlighted">Selected play order</h4>
							<ZslPlaylistLevelRows v-if="revision.levels.length" :levels="revision.levels" />
							<p v-else class="text-sm text-muted">No levels selected yet.</p>
						</section>
						<details
							v-if="revision.verifiedRevision !== revision.selectedRevision && revision.verifiedLevels.length"
							class="rounded-xl border border-default p-3"
						>
							<summary class="cursor-pointer rounded-sm text-sm font-semibold text-highlighted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
								Previous verified play order #{{ revision.verifiedRevision }}
							</summary>
							<ZslPlaylistLevelRows :levels="revision.verifiedLevels" class="mt-3" />
						</details>
						<section v-if="revision.pendingCandidates.length" class="space-y-2" aria-labelledby="warmup-pending-candidates">
							<h4 id="warmup-pending-candidates" class="text-sm font-semibold text-highlighted">Warmup candidates being checked</h4>
							<ZslPlaylistLevelRows :levels="revision.pendingCandidates" />
						</section>
						<section v-if="revision.rejectedCandidates.length" class="space-y-2" aria-labelledby="warmup-rejected-candidates">
							<h4 id="warmup-rejected-candidates" class="text-sm font-semibold text-highlighted">Rejected warmup candidates</h4>
							<ZslPlaylistLevelRows :levels="revision.rejectedCandidates" />
						</section>
					</template>
				</div>
			</UCard>
		</div>
	</section>
</template>
