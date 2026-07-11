<template>
	<USelectMenu
		v-model="selectedLocale"
		:items="localeOptions"
		value-key="code"
		label-key="name"
		size="sm"
		class="w-28"
		:aria-label="$t('actions.locale')"
	/>
</template>

<script setup lang="ts">
const { locale, locales, setLocale } = useI18n()

const localeOptions = computed(() =>
	locales.value.map((item) => ({
		code: item.code,
		name: item.name ?? item.code,
	})),
)

const selectedLocale = computed({
	get: () => locale.value,
	set: (value: string) => {
		void setLocale(value)
	},
})
</script>
