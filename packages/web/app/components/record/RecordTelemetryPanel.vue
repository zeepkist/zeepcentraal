<template>
	<LevelTelemetryPanel :model="model" :description="description" />
</template>

<script setup lang="ts">
import type { RecordTelemetryModel } from '~/types/app'

defineProps<{
	model: RecordTelemetryModel
	description: string
}>()
</script>
