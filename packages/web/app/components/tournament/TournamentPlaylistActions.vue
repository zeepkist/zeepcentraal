<template>
	<UFieldGroup size="lg">
		<UButton
			:to="primaryPath"
			download
			external
			color="primary"
			variant="solid"
			icon="i-tabler-download"
		>
			{{ primaryLabel }}
		</UButton>
		<UDropdownMenu :items="items" :content="{ align: 'end' }">
			<UButton
				color="primary"
				variant="solid"
				icon="i-tabler-chevron-down"
				square
				:aria-label="$t('tournaments.playlists.moreDownloads')"
			/>
		</UDropdownMenu>
	</UFieldGroup>
</template>

<script setup lang="ts">
import type { TrackTournamentType } from '~/types/tournament'
import { tournamentPlaylistPath } from '~/utils/tournamentPlaylist'

const props = defineProps<{
	type: TrackTournamentType
	formatName: string
	slug?: string
}>()
const { t } = useI18n()
const primaryPath = computed(() =>
	props.slug ? tournamentPlaylistPath(props.type, props.slug) : tournamentPlaylistPath(props.type),
)
const primaryLabel = computed(() =>
	props.slug
		? t('tournaments.playlists.downloadTournament')
		: t('tournaments.playlists.downloadFormat', { format: props.formatName }),
)
const items = computed(() => [
	[
		...(props.slug
			? [
					{
						label: t('tournaments.playlists.downloadFormat', { format: props.formatName }),
						icon: 'i-tabler-download',
						to: tournamentPlaylistPath(props.type),
						external: true,
						download: true,
					},
				]
			: []),
		{
			label: t('tournaments.playlists.downloadAll'),
			icon: 'i-tabler-download',
			to: tournamentPlaylistPath(),
			external: true,
			download: true,
		},
	],
])
</script>
