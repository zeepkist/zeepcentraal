<script setup lang="ts">
import ZslPlaylists from './ZslPlaylists.vue'
import type { Points, Round, Season, ZslDashboard } from './zslTypes'
import { londonTimestamp, zslError } from './zslTypes'

const { data, refresh, error: loadError, pending } = useFetch<ZslDashboard>('/api/admin/zsl', { lazy: true })
type Kind = 'round' | 'season' | 'points'
type Field = { key: string; label: string; type?: 'number' | 'date' }
const collections = { round: 'rounds', season: 'seasons', points: 'points' } as const
const labels = { round: 'Rounds', season: 'Seasons', points: 'Points structures' }
const fields: Record<Kind, Field[]> = {
	round: [
		{ key: 'number', label: 'Round number', type: 'number' },
		{ key: 'workshopId', label: 'Workshop collection ID' },
		{ key: 'steamAnnouncementId', label: 'Steam announcement ID' },
		{ key: 'eventDate', label: 'Timeslot 1 start', type: 'date' },
		{ key: 'event2Date', label: 'Timeslot 2 start', type: 'date' },
		{ key: 'submissionStart', label: 'Submission start', type: 'date' },
		{ key: 'submissionEnd', label: 'Submission end', type: 'date' },
		{ key: 'zslVoteEnd', label: 'ZSL vote end', type: 'date' },
		{ key: 'cosmeticVoteEnd', label: 'Cosmetic vote end', type: 'date' },
	],
	season: [
		{ key: 'startDate', label: 'Season start', type: 'date' },
		{ key: 'endDate', label: 'Season end', type: 'date' },
	],
	points: [
		{ key: 'points', label: 'Points by position, comma-separated' },
		{ key: 'minimumPoints', label: 'Minimum points', type: 'number' },
		{ key: 'bestOf', label: 'Best-of count', type: 'number' },
	],
}
const kind = shallowRef<Kind>('round')
const selected = shallowRef<number | null>(null)
const form = ref<Record<string, string>>({})
const saving = shallowRef(false)
const mounted = shallowRef(false)
const status = shallowRef('')
const error = shallowRef('')
const rows = computed(() => data.value?.[collections[kind.value]] ?? [])
const record = computed(() => rows.value.find((row) => row.id === selected.value))
const relationship = computed(() => kind.value === 'round' ? 'seasonId' : 'pointsStructureId')
const targetRows = computed(() => kind.value === 'round' ? data.value?.seasons : data.value?.points)
const targetItems = computed(() => targetRows.value?.map((row) => ({
	label: row.name,
	value: String(row.id),
})) ?? [])
const recordLabel = computed(() => kind.value === 'points' ? 'points structure' : kind.value)
const tabs = computed(() => Object.entries(labels).map(([value, label]) => ({
	value,
	label,
	disabled: !mounted.value || saving.value,
})))

function fieldRequired(field: Field) {
	return field.type === 'number' || ['points', 'startDate', 'endDate', 'eventDate'].includes(field.key)
}

function select(id: number | null) {
	selected.value = id
	const source = rows.value.find((row) => row.id === id) as (Round | Season | Points) & Record<string, unknown> | undefined
	const next: Record<string, string> = { name: source?.name ?? '' }
	if (kind.value !== 'points') next[relationship.value] = String(source?.[relationship.value] ?? '')
	for (const field of fields[kind.value]) {
		const value = source?.[field.key]
		next[field.key] = field.type === 'date' ? londonTimestamp(value as string | null) : String(value ?? '')
	}
	form.value = next
	error.value = ''
	status.value = ''
}

function changeKind(next: string | number) {
	if (next !== 'round' && next !== 'season' && next !== 'points') return
	kind.value = next
	select(null)
}

async function reloadSettings() {
	await refresh()
	select(selected.value)
}

function copyPoints() {
	selected.value = null
	form.value.name = `${form.value.name} (copy)`
	error.value = ''
	status.value = ''
}

async function save() {
	saving.value = true
	error.value = ''
	status.value = ''
	try {
		const settings: Record<string, unknown> = { kind: kind.value, name: form.value.name?.trim() }
		if (kind.value !== 'points') settings[relationship.value] = Number(form.value[relationship.value])
		for (const field of fields[kind.value]) {
			const text = form.value[field.key]?.trim() ?? ''
			settings[field.key] = field.type === 'number' ? Number(text) : text || null
			const original = (record.value as Record<string, unknown> | undefined)?.[field.key]
			if (field.type === 'date' && typeof original === 'string' && londonTimestamp(original) === text) {
				settings[field.key] = original
			}
			if (field.key === 'points') {
				const values = text.split(',').map((value) => value.trim())
				if (values.some((value) => !/^\d+$/.test(value))) throw new Error('Enter whole points separated by commas')
				settings.points = values.map(Number)
			}
		}
		const result = await $fetch<{ id: number }>('/api/admin/zsl', {
			method: 'POST',
			body: { id: selected.value, version: record.value?.version, settings },
		})
		await refresh()
		select(result.id)
		status.value = 'Saved'
	} catch (failure) {
		error.value = zslError(failure)
	} finally {
		saving.value = false
	}
}

select(null)
onMounted(() => {
	mounted.value = true
})
</script>

<template>
	<UTabs
		:model-value="kind"
		:items="tabs"
		aria-label="ZSL settings"
		variant="pill"
		class="w-full"
		:ui="{ list: 'w-full self-start rounded-xl border border-border bg-card/60 sm:w-fit', content: 'space-y-6 pt-4' }"
		@update:model-value="changeKind"
	>
		<template #content>
			<UAlert v-if="loadError" color="error" variant="soft" title="Settings unavailable" role="alert" :description="zslError(loadError)" />
			<div class="grid items-start gap-6 lg:grid-cols-[minmax(13rem,1fr)_3fr]">
				<UCard class="min-w-0 rounded-2xl border-border/80 bg-card/90">
					<template #header>
						<div class="flex flex-wrap items-center justify-between gap-3">
							<h2 class="font-semibold text-highlighted">{{ labels[kind] }}</h2>
							<UButton color="neutral" variant="soft" size="sm" icon="i-tabler-plus" :disabled="!mounted || saving" @click="select(null)">
								Add {{ recordLabel }}
							</UButton>
						</div>
					</template>
					<USkeleton v-if="pending && !rows.length" class="h-9 rounded-lg" />
					<p v-else-if="!rows.length && !loadError" class="text-sm text-muted">No {{ labels[kind].toLowerCase() }} yet.</p>
					<ul v-else class="max-h-56 space-y-1 overflow-y-auto lg:max-h-96">
						<li v-for="row in rows" :key="row.id">
							<UButton
								:color="selected === row.id ? 'primary' : 'neutral'"
								:variant="selected === row.id ? 'soft' : 'ghost'"
								:aria-pressed="selected === row.id"
								:disabled="!mounted || saving"
								block
								class="justify-between text-left"
								@click="select(row.id)"
							>
								<span class="min-w-0 break-words">{{ row.name }}</span>
								<span class="shrink-0 text-xs text-muted">#{{ row.id }}</span>
							</UButton>
						</li>
					</ul>
				</UCard>
				<div class="min-w-0 space-y-6">
					<UCard class="rounded-2xl border-border/80 bg-card/90">
						<template #header>
							<h2 class="font-semibold text-highlighted">{{ selected ? 'Edit' : 'New' }} {{ recordLabel }}</h2>
						</template>
						<form class="grid gap-4 sm:grid-cols-2" @submit.prevent="save">
							<UFormField label="Name" name="name" required>
								<UInput v-model="form.name" class="w-full" required :maxlength="256" />
							</UFormField>
							<UFormField v-if="kind !== 'points'" :label="kind === 'round' ? 'Season' : 'Points structure'" :name="relationship" required>
								<USelect v-model="form[relationship]" :items="targetItems" placeholder="Select" class="w-full" required />
							</UFormField>
							<p v-if="kind !== 'points'" class="text-sm text-muted sm:col-span-2">
								Europe/London. Enter a timestamp with its UTC offset, such as 2027-07-04T18:00:00+01:00.
							</p>
							<UFormField
								v-for="field in fields[kind]"
								:key="field.key"
								:label="field.label"
								:name="field.key"
								:required="fieldRequired(field)"
							>
								<UInput
									:model-value="form[field.key]"
									:type="field.type === 'number' ? 'number' : 'text'"
									:required="fieldRequired(field)"
									class="w-full"
									@update:model-value="form[field.key] = String($event ?? '')"
								/>
							</UFormField>
							<div class="flex flex-wrap gap-2 sm:col-span-2">
								<UButton type="submit" :loading="saving" :disabled="!mounted || pending || !!loadError">Save</UButton>
								<UButton v-if="kind === 'points' && selected" color="neutral" variant="outline" :disabled="saving" @click="copyPoints">Copy structure</UButton>
								<UButton color="neutral" variant="ghost" :loading="pending" :disabled="saving" @click="reloadSettings">Reload settings</UButton>
							</div>
							<UAlert v-if="error" color="error" variant="soft" title="Save failed" role="alert" :description="error" class="sm:col-span-2" />
							<UAlert v-if="status" color="success" variant="soft" :title="status" role="status" class="sm:col-span-2" />
						</form>
					</UCard>
					<ZslPlaylists v-if="kind === 'round' && selected && record" :key="selected" :round="record as Round" />
				</div>
			</div>
		</template>
	</UTabs>
</template>
