<template>
	<UFooter :ui="{ root: 'border-t border-border' }">
		<template #left>
			<p class="text-sm text-muted-foreground">
				{{ $t('footer.copyright') }}
			</p>
		</template>

		<template #right>
			<UButton
				v-for="link in externalLinks"
				:key="link.key"
				:to="link.href"
				target="_blank"
				rel="noreferrer"
				color="neutral"
				variant="ghost"
				size="sm"
			>
				<TablerIcon :name="link.icon" />
				<span>{{ $t(`external.${link.key}.short`) }}</span>
			</UButton>
		</template>
	</UFooter>
</template>

<script setup lang="ts">
import { externalLinks } from '~/utils/navigation'
</script>
