<script setup vapor lang="ts">
import LoginPrompt from '~/components/auth/LoginPrompt.vue'
import type { LevelSummary } from '~/types/app'
import { voteCandidateLevel } from '~/utils/superLeagueVote'

const config = useRuntimeConfig()
const session = useSessionStore()
const { login } = useAccountActions()
const route = useRoute()
const requestedRound = Number(route.query.roundId)
const { snapshot, pending, error, refresh } = useSuperLeagueVote(Number.isInteger(requestedRound) && requestedRound > 0 ? requestedRound : undefined)
const voteType = shallowRef(1)
const selected = ref<number[]>([])
const token = shallowRef<string | null>(null)
const challengeKey = shallowRef(0)
const saving = shallowRef(false)
const saved = shallowRef(false)
const saveError = shallowRef<string | null>(null)
const names = ['Zeepkist Super League', 'Decoration', 'Layout']
const maxPicks = computed(() => voteType.value === 1 ? 14 : 3)
const voteDeadline = computed(() => voteType.value === 1
	? snapshot.value?.zslVoteEnd
	: snapshot.value?.cosmeticVoteEnd)
const openTypes = computed(() => snapshot.value?.openTypes ?? [])
const pendingTypes = computed(() => openTypes.value.filter(type => !snapshot.value?.votes[type - 1]?.length))
const savedTypes = computed(() => snapshot.value?.votes.flatMap((votes, index) => votes.length ? [index + 1] : []) ?? [])
const activeTab = computed({
	get: () => String(voteType.value),
	set: (value: string) => { voteType.value = Number(value) },
})
const tabItems = computed(() => openTypes.value.map(type => ({
	label: names[type - 1],
	value: String(type),
	slot: 'ballot' as const,
	badge: snapshot.value?.votes[type - 1]?.length ? 'Saved' : undefined,
})))
const cards = computed<LevelSummary[]>(() => (snapshot.value?.candidates ?? []).map(voteCandidateLevel))
const ownLevels = computed(() => new Set((snapshot.value?.candidates ?? [])
	.filter(candidate => candidate.selfAuthored).map(candidate => candidate.levelId)))

watch(snapshot, value => {
	if (!value) return
	if (!value.openTypes.includes(voteType.value)) voteType.value = value.openTypes[0] ?? 1
	selected.value = [...(value.votes[voteType.value - 1] ?? [])]
})
watch(voteType, type => {
	selected.value = [...(snapshot.value?.votes[type - 1] ?? [])]
	token.value = null
	challengeKey.value++
	saved.value = false
})

function toggle(id: number) {
	const next = [...selected.value]
	const index = next.indexOf(id)
	if (index >= 0) next.splice(index, 1)
	else if (next.length < maxPicks.value && !ownLevels.value.has(id)) next.push(id)
	selected.value = next
	saved.value = false
}

async function submit() {
	if (!snapshot.value || !token.value || saving.value || selected.value.length === 0) return
	saving.value = true
	saveError.value = null
	try {
		await $fetch(new URL('/super-league/vote', String(config.public.backendUrl)).toString(), {
			method: 'POST', credentials: 'include',
			body: { roundId: snapshot.value.roundId, voteType: voteType.value,
				levelIds: selected.value, turnstileToken: token.value },
		})
		await refresh()
		saved.value = true
	} catch (cause) {
		saveError.value = cause instanceof Error ? cause.message : 'Vote could not be saved'
	} finally {
		saving.value = false
		token.value = null
		challengeKey.value++
	}
}
</script>

<template>
	<UContainer class="space-y-6 py-8">
		<PageHeader eyebrow="Zeepkist Super League" title="Vote for contest levels" />
		<LoginPrompt
			v-if="!session.user"
			:title="$t('auth.loginPrompt.voteTitle')"
			:description="$t('auth.loginPrompt.voteDescription')"
			@login="login"
		/>
		<p v-else-if="pending && !snapshot">Loading contest…</p>
		<p v-else-if="error" role="alert" class="text-error">{{ error }}</p>
		<p v-else-if="!snapshot">No current contest voting period.</p>
		<template v-else>
			<div v-if="pendingTypes.length" class="rounded-xl border border-border bg-card/60 p-4">
				<p class="font-medium text-highlighted">You can still vote in these categories:</p>
				<ul class="mt-3 flex flex-wrap gap-2">
					<li v-for="type in pendingTypes" :key="type">
						<UBadge color="primary" variant="soft">{{ names[type - 1] }}</UBadge>
					</li>
				</ul>
			</div>
			<p v-if="savedTypes.length" class="text-sm text-muted-foreground">
				Saved votes: {{ savedTypes.map(type => names[type - 1]).join(', ') }}.
			</p>
			<UTabs v-if="openTypes.length" v-model="activeTab" :items="tabItems" aria-label="Vote category"
				color="primary" variant="pill" class="w-full"
				:ui="{ list: 'w-full flex-wrap justify-start rounded-xl border border-border bg-card/60 p-1.5', content: 'pt-6 outline-none' }">
				<template #ballot>
					<div class="space-y-6">
						<div v-if="voteDeadline" class="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
							<TablerIcon name="clock" class="size-4 shrink-0 text-primary" />
							<p>Voting closes <NuxtTime :datetime="voteDeadline" relative numeric="always" />.</p>
						</div>
						<BallotGuidance :vote-type="voteType" />
						<p class="text-sm font-medium text-highlighted">{{ selected.length }} of {{ maxPicks }} levels selected</p>
						<BallotCards :levels="cards" :selected="selected" :own-levels="ownLevels"
							:max-picks="maxPicks" @toggle="toggle" />
						<VoteTurnstile :key="challengeKey" @token="token = $event" />
						<UButton :loading="saving" :disabled="!token || !selected.length || saving" @click="submit">Submit vote</UButton>
						<p v-if="saved" role="status">Vote saved.</p>
						<p v-if="saveError" role="alert" class="text-error">{{ saveError }}</p>
					</div>
				</template>
			</UTabs>
			<p v-else-if="snapshot.votingPending">Ballots are being prepared. Check back shortly.</p>
			<p v-else>Voting has closed. Your saved ballots remain above.</p>
		</template>
	</UContainer>
</template>
