<script setup lang="ts">
import { MEDALS } from '~/utils/medals'

const props = defineProps<{ tier?: number | null; thresholdMs?: number | null }>()
const { t } = useAppI18n()
const medal = computed(() => MEDALS.find(value => value.tier === props.tier))
const title = computed(() => medal.value ? `${t(medal.value.labelKey)}${props.thresholdMs != null ? ` · ${(props.thresholdMs / 1000).toFixed(3)}s` : ''}` : t('medals.none'))
</script>

<template>
	<span class="relative inline-flex h-[1em] w-8 items-center justify-center align-middle">
		<img v-if="medal" :src="medal.src" :alt="t(medal.labelKey)" :title="title" width="32" height="32" class="absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 object-contain" />
		<span v-else class="text-muted-foreground" :title="t('medals.none')">—</span>
	</span>
</template>
