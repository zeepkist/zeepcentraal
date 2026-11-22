<script setup vapor lang="ts">
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

function changeKind(next: Kind) {
	kind.value = next
	select(null)
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
	<nav aria-label="ZSL settings" class="mb-5 flex flex-wrap gap-2">
		<button v-for="(label, tab) in labels" :key="tab" type="button"
			:aria-pressed="kind === tab" :disabled="!mounted || saving"
			class="rounded border px-4 py-2 aria-pressed:font-bold" @click="changeKind(tab)">
			{{ label }}
		</button>
	</nav>
	<p v-if="loadError" role="alert" class="mb-4">{{ zslError(loadError) }}</p>
	<div class="grid gap-6 md:grid-cols-[minmax(12rem,1fr)_3fr]">
		<aside>
			<button type="button" class="mb-3 rounded border px-3 py-2" :disabled="!mounted || saving" @click="select(null)">Add {{ kind === 'points' ? 'points structure' : kind }}</button>
			<ul class="space-y-1">
				<li v-for="row in rows" :key="row.id">
					<button type="button" class="w-full rounded px-3 py-2 text-left aria-pressed:font-bold"
						:aria-pressed="selected === row.id" :disabled="!mounted || saving" @click="select(row.id)">
						{{ row.name }} <span class="opacity-70">#{{ row.id }}</span>
					</button>
				</li>
			</ul>
		</aside>
		<div class="min-w-0">
			<form class="grid gap-4 rounded border p-4 sm:grid-cols-2" @submit.prevent="save">
				<h2 class="text-lg font-semibold sm:col-span-2">{{ selected ? 'Edit' : 'New' }} {{ kind === 'points' ? 'points structure' : kind }}</h2>
				<label class="grid gap-1">Name
					<input v-model="form.name" class="rounded border px-3 py-2" required maxlength="256">
				</label>
				<label v-if="kind !== 'points'" class="grid gap-1">{{ kind === 'round' ? 'Season' : 'Points structure' }}
					<select v-model="form[relationship]" class="rounded border px-3 py-2" required>
						<option value="">Select</option>
						<option v-for="target in targetRows" :key="target.id" :value="String(target.id)">{{ target.name }}</option>
					</select>
				</label>
				<p v-if="kind !== 'points'" class="text-sm opacity-80 sm:col-span-2">Europe/London. Enter a timestamp with its UTC offset, such as 2027-07-04T18:00:00+01:00.</p>
				<label v-for="field in fields[kind]" :key="field.key" class="grid gap-1">
					{{ field.label }}
					<input v-model="form[field.key]" class="min-w-0 rounded border px-3 py-2"
						:type="field.type === 'number' ? 'number' : 'text'"
						:required="field.type === 'number' || ['points', 'startDate', 'endDate', 'eventDate'].includes(field.key)">
				</label>
				<div class="flex flex-wrap gap-2 sm:col-span-2">
					<button type="submit" class="rounded border px-4 py-2 font-semibold" :disabled="!mounted || saving || pending || !!loadError">{{ saving ? 'Saving…' : 'Save' }}</button>
					<button v-if="kind === 'points' && selected" type="button" class="rounded border px-4 py-2" :disabled="saving" @click="copyPoints">Copy structure</button>
					<button type="button" class="rounded border px-4 py-2" :disabled="saving" @click="async () => { await refresh(); select(selected) }">Reload settings</button>
				</div>
				<p v-if="error" role="alert" class="sm:col-span-2">{{ error }}</p>
				<p v-if="status" role="status" class="sm:col-span-2">{{ status }}</p>
			</form>
			<ZslPlaylists v-if="kind === 'round' && selected && record" :key="selected" :round="record as Round" />
		</div>
	</div>
</template>
