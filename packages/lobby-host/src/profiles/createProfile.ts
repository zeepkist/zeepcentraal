import type { ManagedRoomConfig } from '@zeepkist/core/config/lobby-host'
import type { ManagedLobbyProfile, RoomLogger } from './contracts'
import { type TournamentDependencies, TrackTournamentProfile } from './trackTournament/profile'
import { ZslSubmissionsProfile } from './zslSubmissions/profile'
export function createProfile(
	config: ManagedRoomConfig,
	shared: TournamentDependencies,
	logger: RoomLogger,
): ManagedLobbyProfile {
	switch (config.profile.type) {
		case 'track-tournament':
			return new TrackTournamentProfile(
				{ ...config, profile: config.profile },
				shared,
				logger,
			)
		case 'zsl-submissions':
			return new ZslSubmissionsProfile(
				config.profile.threadId,
				shared.payloads,
				logger,
				config.roundTimeSeconds,
			)
		default:
			throw new Error('Unsupported managed room profile')
	}
}
