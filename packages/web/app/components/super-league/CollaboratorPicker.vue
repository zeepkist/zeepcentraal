<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import type { SubmissionAuthor } from '~/utils/superLeagueSubmission'
import { submissionAuthorChoices } from '~/utils/superLeagueSubmission'

const props = defineProps<{ excluded: string[]; label: string }>()
const emit = defineEmits<{ select: [author: SubmissionAuthor]; remove: [] }>()
const config = useRuntimeConfig()
const query = ref('')
const results = shallowRef<SubmissionAuthor[]>([])
const pending = ref(false)
const error = ref<string | null>(null)
let request = 0
let controller: AbortController | undefined
watchDebounced(query, async value => {
	const current = ++request
	controller?.abort()
	results.value = []
	error.value = null
	const term = value.trim()
	if (term.length < 2) { pending.value = false; return }
	const activeController = new AbortController()
	controller = activeController
	pending.value = true
	const numeric = /^[0-9]+$/.test(term)
	const document = numeric
		? 'query Collaborator($id: BigInt!) { users(filter: { steamId: { equalTo: $id } }, first: 10) { nodes { steamName steamId } } }'
		: 'query Collaborator($name: String!) { users(filter: { steamName: { likeInsensitive: $name } }, first: 10) { nodes { steamName steamId } } }'
	try {
		const response = await $fetch<{ data?: { users: { nodes: { steamName: string | null; steamId: string | null }[] } }; errors?: unknown[] }>(String(config.public.graphqlHttpUrl), {
			method: 'POST', signal: activeController.signal, body: { query: document, variables: numeric ? { id: term } : { name: `${term}%` } },
		})
		if (current !== request) return
		if (response.errors) throw new Error('Search failed')
		results.value = submissionAuthorChoices(term, response.data?.users.nodes ?? [], props.excluded)
	} catch { if (current === request && !activeController.signal.aborted) error.value = 'Could not search accounts.' }
	finally { if (current === request) pending.value = false }
}, { debounce: 300 })
onScopeDispose(() => { request++; controller?.abort() })
</script>
<template>
	<div class="space-y-2">
		<div class="flex items-end gap-2">
			<UFormField :label="label" class="flex-1"><UInput v-model="query" placeholder="Steam name or Steam ID" class="w-full" /></UFormField>
			<UButton variant="ghost" color="neutral" aria-label="Remove collaborator field" @click="emit('remove')">Remove</UButton>
		</div>
		<p v-if="pending" class="text-sm text-muted">Searching…</p>
		<p v-else-if="error" role="alert" class="text-sm text-error">{{ error }}</p>
		<div v-else-if="results.length" class="rounded-lg border border-default p-1">
			<UButton v-for="author in results" :key="author.steamId" variant="ghost" color="neutral" class="flex w-full justify-start" @click="emit('select', author)">{{ author.steamName }} <span class="text-muted">{{ author.steamId }}</span></UButton>
		</div>
		<p v-else-if="query.trim().length >= 2" class="text-sm text-muted">No matching accounts. Enter their Steam ID to add them.</p>
	</div>
</template>
