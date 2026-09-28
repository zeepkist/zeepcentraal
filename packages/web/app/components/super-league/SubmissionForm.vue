<script setup lang="ts">
import type { LevelSubmission, SubmissionAuthor, SubmissionContest } from '~/utils/superLeagueSubmission'
import { submissionWorkshopId } from '~/utils/superLeagueSubmission'
import CollaboratorPicker from './CollaboratorPicker.vue'

const props = defineProps<{ contest: SubmissionContest; submission: LevelSubmission | null; viewer: SubmissionAuthor; saving: boolean }>()
const emit = defineEmits<{ submit: [workshopId: string, authors: string[]]; withdraw: [] }>()
const url = ref('')
const collaborators = ref<SubmissionAuthor[]>([])
const adding = ref(false)
const validationError = ref<string | null>(null)
const excluded = computed(() => [props.viewer.steamId, ...collaborators.value.map(author => author.steamId)])
watch(
    [() => props.submission?.id, () => props.submission?.revision],
    () => {
        const submission = props.submission
        url.value = submission ? `https://steamcommunity.com/sharedfiles/filedetails/?id=${submission.workshopId}` : ''
        collaborators.value = submission?.authors.flatMap((id, index) => id !== props.viewer.steamId ? [{ steamId: id, steamName: submission.authorNames[index] ?? id }] : []) ?? []
        adding.value = false
    },
    { immediate: true },
)
function select(author: SubmissionAuthor) {
	if (collaborators.value.length >= 2 || excluded.value.includes(author.steamId)) return
	collaborators.value.push(author)
	adding.value = false
}
function submit() {
	const id = submissionWorkshopId(url.value)
	validationError.value = id ? null : 'Enter a Steam Workshop URL: https://steamcommunity.com/sharedfiles/filedetails/?id=123'
	if (id) emit('submit', id, excluded.value)
}
</script>
<template>
	<UCard>
		<form class="space-y-5" @submit.prevent="submit">
			<UFormField label="Steam Workshop item URL" :error="validationError ?? undefined" required>
				<UInput v-model="url" type="url" placeholder="https://steamcommunity.com/sharedfiles/filedetails/?id=…" class="w-full" :disabled="saving" />
			</UFormField>
			<div class="space-y-3">
				<h3 class="font-semibold">Authors</h3>
				<p class="text-sm text-muted">{{ viewer.steamName }} <span class="font-mono">{{ viewer.steamId }}</span></p>
				<div v-for="(author, index) in collaborators" :key="author.steamId" class="flex items-center justify-between gap-2 rounded-lg bg-elevated p-3">
					<span>{{ author.steamName }} <span class="text-xs text-muted">{{ author.steamId }}</span></span>
					<UButton variant="ghost" color="neutral" :disabled="saving" @click="collaborators.splice(index, 1)">Remove</UButton>
				</div>
				<CollaboratorPicker v-if="adding" :excluded="excluded" :label="`Collaborator ${collaborators.length + 1}`" @select="select" @remove="adding = false" />
				<UButton v-else-if="collaborators.length < 2" variant="outline" color="neutral" :disabled="saving" @click="adding = true">Add collaborator</UButton>
				<p class="text-sm text-muted">Up to 3 authors. Include the workshop owner. Each author can enter one level per contest; any author can edit or withdraw it.</p>
			</div>
			<div class="flex flex-wrap gap-3">
				<UButton type="submit" :loading="saving">{{ submission?.status !== 'withdrawn' && submission ? 'Update submission' : 'Submit level' }}</UButton>
				<UButton v-if="submission && submission.status !== 'withdrawn'" variant="outline" color="error" :disabled="saving" @click="emit('withdraw')">Withdraw submission</UButton>
			</div>
		</form>
	</UCard>
</template>
