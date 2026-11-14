<script setup lang="ts">
import { useTimeoutFn } from '@vueuse/core'
import { shallowRef, useTemplateRef } from 'vue'

defineProps<{ sheet: string }>()

const { t } = useAppI18n()
const examples = useTemplateRef<HTMLElement>('examples')
const copyState = shallowRef<'idle' | 'copied' | 'failed'>('idle')
const { start: startResetTimer, stop: stopResetTimer } = useTimeoutFn(
	() => {
		copyState.value = 'idle'
	},
	3000,
	{ immediate: false },
)

async function copyGrid() {
	stopResetTimer()
	const sprites = examples.value?.querySelector('pre code')?.textContent?.match(/<sprite\b[^>]*>/g)
	if (!sprites?.length) {
		copyState.value = 'failed'
		return
	}

	const rows: string[] = []
	for (let offset = 0; offset < sprites.length; offset += 4) {
		rows.push(
			sprites
				.slice(offset, offset + 4)
				.map((sprite, column) => `<pos=${column * 4}em>${sprite}`)
				.join(''),
		)
	}

	try {
		await navigator.clipboard.writeText(
			`<align=left><line-height=200%>${rows.join('\n')}</line-height></align>`,
		)
		copyState.value = 'copied'
		startResetTimer()
	} catch {
		copyState.value = 'failed'
	}
}
</script>

<template>
	<fieldset class="my-6 min-w-0">
		<legend class="sr-only">{{ sheet }}</legend>
		<div ref="examples"><slot /></div>
		<div class="not-prose flex flex-wrap items-center gap-3">
			<UButton
				type="button"
				color="neutral"
				variant="soft"
				:label="copyState === 'copied' ? t('wikiContent.spriteGrid.copied') : t('wikiContent.spriteGrid.copy')"
				:aria-label="t('wikiContent.spriteGrid.copyLabel', { sheet })"
				:icon="copyState === 'copied' ? 'i-tabler-check' : 'i-tabler-copy'"
				@click="copyGrid"
			/>
			<span role="status" :class="copyState === 'failed' ? 'text-sm text-error' : 'sr-only'">
				{{ copyState === 'failed' ? t('wikiContent.spriteGrid.failed') : copyState === 'copied' ? t('wikiContent.spriteGrid.copied') : '' }}
			</span>
		</div>
	</fieldset>
</template>
