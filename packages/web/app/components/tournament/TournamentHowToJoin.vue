<template>
	<section aria-labelledby="tournament-how-to-join-heading">
		<div class="flex flex-col gap-8 lg:flex-row lg:gap-14">
			<div class="max-w-md shrink-0 lg:w-80">
				<SectionHeader
					id="tournament-how-to-join-heading"
					:title="$t('tournaments.howToJoin.title')"
					:description="$t('tournaments.howToJoin.description')"
				/>

				<div class="mt-6 border-l-2 border-primary pl-4">
					<p class="font-bold text-highlighted">
						{{ $t('tournaments.howToJoin.flexible.title') }}
					</p>
					<p class="mt-1 text-sm leading-6 text-muted">
						{{ $t('tournaments.howToJoin.flexible.description') }}
					</p>
				</div>

				<div class="mt-6 flex gap-3">
					<span class="mt-2 size-2 shrink-0 rounded-full bg-success" />
					<div>
						<h3 class="font-bold text-highlighted">
							{{ $t('tournaments.howToJoin.updates.title') }}
						</h3>
						<p class="mt-1 text-sm leading-6 text-muted">
							{{ $t('tournaments.howToJoin.updates.description') }}
						</p>
					</div>
				</div>
			</div>

			<div class="min-w-0 flex-1">
				<ol>
					<li class="flex gap-5 py-6">
						<span class="w-8 shrink-0 pt-0.5 font-black tabular-nums text-primary">01</span>
						<div>
							<h3 class="font-bold text-highlighted">
								{{ $t('tournaments.howToJoin.setup.title') }}
							</h3>
							<p class="mt-1 text-sm leading-6 text-muted">
								{{ $t('tournaments.howToJoin.setup.description') }}
							</p>
							<UButton
								to="/wiki/setup-modkist"
								color="neutral"
								variant="soft"
								icon="i-tabler-plug-connected"
								class="mt-3"
							>
								{{ $t('tournaments.howToJoin.setup.action') }}
							</UButton>
						</div>
					</li>

					<li class="flex gap-5 py-6">
						<span class="w-8 shrink-0 pt-0.5 font-black tabular-nums text-primary">02</span>
						<div class="min-w-0">
							<h3 class="font-bold text-highlighted">
								{{ $t('tournaments.howToJoin.room.title') }}
							</h3>
							<p class="mt-1 text-sm leading-6 text-muted">
								{{ $t('tournaments.howToJoin.room.description') }}
							</p>
							<ul class="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
								<li>{{ $t('tournaments.howToJoin.room.join') }}</li>
								<li>
									{{ $t('tournaments.howToJoin.room.download') }}
									<code class="rounded bg-muted px-1.5 py-0.5 text-xs text-highlighted">%AppData%\Zeepkist\Playlists</code>
								</li>
								<li>{{ $t('tournaments.howToJoin.room.host') }}</li>
							</ul>
							<UButton
								:to="playlistPath"
								download
								external
								color="primary"
								icon="i-tabler-download"
								class="mt-4"
							>
								{{ $t('tournaments.howToJoin.room.action') }}
							</UButton>
						</div>
					</li>

					<li class="flex gap-5 py-6">
						<span class="w-8 shrink-0 pt-0.5 font-black tabular-nums text-primary">03</span>
						<div>
							<h3 class="font-bold text-highlighted">
								{{ $t('tournaments.howToJoin.time.title') }}
							</h3>
							<p class="mt-1 text-sm leading-6 text-muted">
								{{ $t('tournaments.howToJoin.time.description') }}
							</p>
						</div>
					</li>
				</ol>
			</div>
		</div>
	</section>
</template>

<script setup vapor lang="ts">
import type { TrackTournamentType } from '~/types/tournament'
import { tournamentPlaylistPath } from '~/utils/tournamentPlaylist'

const props = defineProps<{ type: TrackTournamentType; slug: string }>()
const playlistPath = computed(() => tournamentPlaylistPath(props.type, props.slug))
</script>
