<script setup lang="ts">
import type { LevelSubmission } from '~/utils/superLeagueSubmission'
import { submissionProcessing } from '~/utils/superLeagueSubmission'

defineProps<{ submission: LevelSubmission }>()
</script>
<template>
	<UCard aria-live="polite">
		<div v-if="submissionProcessing(submission.status)" class="flex items-center gap-3">
			<UIcon name="i-tabler-loader-2" class="size-5 animate-spin" />
			<span>{{ submission.status === 'retrying' ? 'Workshop check delayed. We’ll try again shortly.' : 'Validating your level…' }}</span>
		</div>
		<p v-else-if="submission.status === 'withdrawn'" class="font-semibold">Submission withdrawn.</p>
		<div v-if="submission.validation" class="mt-3 space-y-4">
			<UBadge :color="submission.validation.valid ? 'success' : 'error'">{{ submission.validation.valid ? 'Level valid' : 'Level needs changes' }}</UBadge>
			<dl class="grid gap-4 text-sm sm:grid-cols-2">
				<div><dt class="text-muted">Blocks</dt><dd>{{ submission.validation.measurements.blocks ?? '—' }}</dd></div>
				<div><dt class="text-muted">Checkpoints</dt><dd>{{ submission.validation.measurements.checkpoints ?? '—' }}</dd></div>
				<div><dt class="text-muted">Author time</dt><dd>{{ submission.validation.measurements.authorTime ?? '—' }}s</dd></div>
				<div><dt class="text-muted">Modes</dt><dd>{{ submission.validation.measurements.modes?.join(', ') || 'None' }}</dd></div>
				<div><dt class="text-muted">File UID</dt><dd class="break-all">{{ submission.validation.fileUid ?? '—' }}</dd></div>
				<div><dt class="text-muted">Workshop updated</dt><dd>{{ submission.validation.workshopUpdatedAt }}</dd></div>
			</dl>
			<ul v-if="submission.validation.failures.length" class="list-disc space-y-1 pl-5 text-error"><li v-for="failure in submission.validation.failures" :key="failure">{{ failure }}</li></ul>
		</div>
	</UCard>
</template>
