<template>
	<DataTableFrame>
		<table class="min-w-[60rem] w-full text-right text-sm">
			<thead class="bg-muted/70 text-muted-foreground">
				<tr>
					<th class="px-4 py-3">{{ labels.rank }}</th>
					<th class="min-w-40 px-4 py-3 text-left">{{ labels.player }}</th>
					<th class="px-4 py-3">{{ labels.points }}</th>
					<th class="px-4 py-3">{{ labels.totalPoints }}</th>
					<th class="px-4 py-3">{{ labels.worldRecords }}</th>
					<th v-for="medal in MEDALS" :key="medal.key" :aria-label="t(medal.labelKey)" class="min-w-16 px-4 py-3" scope="col">
						<MedalBadge :tier="medal.tier" />
					</th>
				</tr>
			</thead>
			<tbody>
				<DataTableRow
					v-for="user in users"
					:key="user.id"
					:viewer="viewerUserId === user.id"
					interactive
				>
					<td class="p-0 font-bold tabular-nums">
						<DataTableCellLink
							:to="userPath(user)"
							:aria-label="labels.openPlayer"
							class="px-4 py-3"
							@click.capture="beginTransition($event, user)"
						>
							<span
								:style="transition.sourceStyle(transitionScope, 'user', user.steamId, 'metric')"
								data-shared-transition-source="metric"
							>
								#{{ user.rank ?? '—' }}
							</span>
						</DataTableCellLink>
					</td>
					<td class="p-0 text-left">
						<DataTableCellLink
							:to="userPath(user)"
							focusable
							class="px-4 py-3 font-semibold group-hover:text-primary"
							@click.capture="beginTransition($event, user)"
						>
							<span
								:style="transition.sourceStyle(transitionScope, 'user', user.steamId, 'title')"
								data-shared-transition-source="title"
							>
								{{ user.steamName }}
							</span> <SupporterBadge :supporter="supporters?.[user.id]" />
						</DataTableCellLink>
					</td>
					<td class="p-0 tabular-nums">
						<DataTableCellLink :to="userPath(user)" :aria-label="labels.openPlayer" class="px-4 py-3">
							{{ format(user.points) }}
						</DataTableCellLink>
					</td>
					<td class="p-0 tabular-nums">
						<DataTableCellLink :to="userPath(user)" :aria-label="labels.openPlayer" class="px-4 py-3">
							{{ format(user.totalPoints) }}
						</DataTableCellLink>
					</td>
					<td class="p-0 tabular-nums">
						<DataTableCellLink :to="userPath(user)" :aria-label="labels.openPlayer" class="px-4 py-3">
							{{ format(user.worldRecords) }}
						</DataTableCellLink>
					</td>
					<td v-for="medal in MEDALS" :key="medal.key" class="p-0 tabular-nums">
						<DataTableCellLink :to="userPath(user)" :aria-label="labels.openPlayer" class="px-4 py-3">{{ format(user.medals?.[medal.key]) }}</DataTableCellLink>
					</td>
				</DataTableRow>
			</tbody>
		</table>
	</DataTableFrame>
</template>

<script setup lang="ts">
import type { UserSummary } from '~/types/app'
import { MEDALS } from '~/utils/medals'
import type { SupporterMap } from '~/utils/supporters'

const props = defineProps<{
	users: UserSummary[]
		supporters?: SupporterMap
	viewerUserId?: number
	transitionScope: string
	labels: {
		rank: string
		player: string
		points: string
		totalPoints: string
		worldRecords: string
		openPlayer: string
	}
}>()
const { locale, t } = useAppI18n()
const transition = useSharedViewTransition()
const formatter = computed(() => new Intl.NumberFormat(locale.value))
const format = (value?: number | null) => formatter.value.format(value ?? 0)
const userPath = (user: UserSummary) => `/user/${user.steamId}`

function beginTransition(event: MouseEvent, user: UserSummary) {
	transition.begin({
		event,
		entity: 'user',
		entityId: user.steamId,
		scope: props.transitionScope,
		targetRoute: userPath(user),
		preview: {
			title: user.steamName ?? String(user.steamId),
			metric: user.rank ? `#${formatter.value.format(user.rank)}` : '—',
		},
	})
}
</script>
