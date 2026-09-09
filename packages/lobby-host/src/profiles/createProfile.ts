import type { ManagedRoomConfig } from '@zeepkist/core/config/lobby-host'
import type { ManagedLobbyProfile, RoomLogger } from './contracts'
import { type TournamentDependencies, TrackTournamentProfile } from './trackTournament/profile'
export function createProfile(
	config: ManagedRoomConfig,
	shared: TournamentDependencies,
	logger: RoomLogger,
): ManagedLobbyProfile {
	switch (config.profile.type) {
		case 'track-tournament':
			return new TrackTournamentProfile(config, shared, logger)
		default:
			throw new Error('Unsupported managed room profile')
	}
}
