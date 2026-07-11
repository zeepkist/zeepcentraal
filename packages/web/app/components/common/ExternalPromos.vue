<template>
	<div class="grid gap-3 md:grid-cols-3">
		<UButton
			v-for="link in externalLinks"
			:key="link.key"
			:to="link.href"
			target="_blank"
			rel="noreferrer"
			color="neutral"
			variant="subtle"
			size="lg"
			class="justify-start rounded-lg"
		>
			<TablerIcon :name="link.icon" />
			<span>{{ $t(`external.${link.key}.label`) }}</span>
		</UButton>
	</div>
</template>

<script setup lang="ts">
import { externalLinks } from '~/utils/navigation'
</script>
