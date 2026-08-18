<template>
	<DataTableFrame>
		<table class="w-full min-w-2xl text-left text-sm">
			<thead class="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
				<tr>
					<th scope="col" class="px-4 py-3 font-semibold">{{ labels.room }}</th>
					<th scope="col" class="px-4 py-3 font-semibold">{{ labels.host }}</th>
					<th scope="col" class="px-4 py-3 text-right font-semibold">{{ labels.players }}</th>
				</tr>
			</thead>
			<tbody>
				<DataTableRow v-for="lobby in lobbies" :key="`${lobby.host.steamId}:${lobby.title}`">
					<td class="px-4 py-3 font-semibold text-highlighted">
						<span
							class="flex items-center gap-2"
							:title="!lobby.isPublic ? labels.privateLobby : undefined"
						>
							<TablerIcon
								v-if="!lobby.isPublic"
								name="lock"
								class="size-4 text-muted-foreground"
							/>
							<span v-if="!lobby.isPublic" class="sr-only">{{ labels.privateLobby }}</span>
							<span>{{ lobby.title }}</span>
						</span>
					</td>
					<td class="px-4 py-3">
						<NuxtLink
							:to="`/user/${lobby.host.steamId}`"
							class="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
						>
							{{ lobby.host.name }}
						</NuxtLink>
					</td>
					<td class="tabular px-4 py-3 text-right font-semibold">
						{{ number.format(lobby.players) }}/{{ number.format(lobby.playerLimit) }}
					</td>
				</DataTableRow>
			</tbody>
		</table>
	</DataTableFrame>
</template>

<script setup vapor lang="ts">
import type { LobbyListing } from '@zeepkist/core'
import { getNumberFormatter } from '~/utils/intlFormatters'

defineProps<{
	lobbies: readonly LobbyListing[]
	labels: { room: string; host: string; players: string; privateLobby: string }
}>()

const { locale } = useI18n()
const number = computed(() => getNumberFormatter(locale.value))
</script>
