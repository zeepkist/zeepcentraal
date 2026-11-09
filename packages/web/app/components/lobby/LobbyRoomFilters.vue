<script setup lang="ts">
import { lobbyLabel } from '~/utils/lobbyLabels'

const props = defineProps<{ history?: boolean }>()
const { t } = useAppI18n()
const route = useRoute()
const router = useRouter()
const mounted=shallowRef(false)
onMounted(()=> { mounted.value=true })
const hostSearch = shallowRef(typeof route.query.host === 'string' ? route.query.host : '')
watch(()=>route.query.host,value=> { hostSearch.value=typeof value==='string' ? value : '' })
const hostSuggestions = useAuthorSuggestions(hostSearch)
const sorts = computed(() => props.history ? ['closed','first','last','duration','peak','name'] : ['players','occupancy','peak','age','name'])
async function apply(event: Event) {
	const form = new FormData(event.currentTarget as HTMLFormElement)
	const from=String(form.get('from') ?? ''), to=String(form.get('to') ?? '')
	if(from && to && from>to) {
		const input=(event.currentTarget as HTMLFormElement).elements.namedItem('to')
		if(input instanceof HTMLInputElement) { input.setCustomValidity(t('lobby.analytics.invalidDates'));input.reportValidity() }
		return
	}
	const query = { ...route.query }
	for (const key of ['after','before','last','q','host','visibility','capacity','populated','minPeak','maxPeak','duration','from','to','active','sort']) delete query[key]
	for (const [key,value] of form.entries()) if (typeof value === 'string' && value.trim()) query[key] = value.trim()
	await router.push({ query })
}
function clearValidation(event:Event) {
	const input=(event.currentTarget as HTMLFormElement).elements.namedItem('to')
	if(input instanceof HTMLInputElement) input.setCustomValidity('')
}
</script>

<template>
	<form :key="route.fullPath" class="grid items-end gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4" @submit.prevent="apply" @input="clearValidation">
		<fieldset :disabled="!mounted" class="contents">
		<label class="grid gap-1 text-sm">{{ t('lobby.analytics.search') }}<input name="q" type="search" :value="route.query.q" class="min-w-0 min-h-11 rounded-md border border-border bg-background p-2 text-base" /></label>
		<label class="grid gap-1 text-sm">{{ t('lobby.table.host') }}<input v-model="hostSearch" name="host" pattern="[0-9]{1,19}" :title="t('lobby.analytics.selectHost')" list="lobby-hosts" :placeholder="t('lobby.analytics.hostPlaceholder')" class="min-w-0 min-h-11 rounded-md border border-border bg-background p-2 text-base" /><datalist id="lobby-hosts"><option v-for="host in hostSuggestions.suggestions.value" :key="host.value" :value="host.value">{{ host.label }}</option></datalist></label>
		<label class="grid gap-1 text-sm">{{ t('lobby.analytics.visibility') }}<select name="visibility" :value="route.query.visibility ?? ''" class="min-h-11 rounded-md border border-border bg-background p-2 text-base"><option value="">{{ t('lobby.analytics.all') }}</option><option value="public">{{ t('lobby.analytics.public') }}</option><option value="private">{{ t('lobby.analytics.private') }}</option></select></label>
		<label class="grid gap-1 text-sm">{{ t('lobby.analytics.sort') }}<select name="sort" :value="route.query.sort ?? (history ? 'closed' : 'players')" class="min-h-11 rounded-md border border-border bg-background p-2 text-base"><option v-for="sort in sorts" :key="sort" :value="sort">{{ t(lobbyLabel(`sorts.${sort}`)) }}</option></select></label>
		<template v-if="history">
			<label v-for="field in ['from','to']" :key="field" class="grid gap-1 text-sm">{{ t(lobbyLabel(field)) }}<input :name="field" type="date" :value="route.query[field]" class="min-w-0 min-h-11 rounded-md border border-border bg-background p-2 text-base" /></label>
			<label v-for="field in ['minPeak','maxPeak','duration']" :key="field" class="grid gap-1 text-sm">{{ t(lobbyLabel(field)) }}<input :name="field" type="number" min="0" step="1" :value="route.query[field]" class="min-w-0 min-h-11 rounded-md border border-border bg-background p-2 text-base" /></label>
			<label class="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="active" value="1" :checked="route.query.active === '1'" />{{ t('lobby.analytics.includeActive') }}</label>
		</template>
		<template v-else><label v-for="field in ['capacity','populated']" :key="field" class="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" :name="field" value="1" :checked="route.query[field] === '1'" />{{ t(lobbyLabel(field)) }}</label></template>
		<p v-if="history" class="text-xs text-muted-foreground">{{ t('lobby.analytics.datePolicy') }}</p>
		<UButton type="submit" class="justify-center">{{ t('lobby.analytics.apply') }}</UButton>
		</fieldset>
	</form>
</template>
