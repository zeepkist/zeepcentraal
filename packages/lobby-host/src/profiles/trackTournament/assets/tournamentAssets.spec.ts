import { expect, mock, test } from 'bun:test'
import { LevelPayloadCache } from '../../../assets/levelPayloadCache'

const select = mock(async (_type: number) => undefined)
mock.module('@zeepkist/database', () => ({
	getPreferredTrackTournamentLobbyAsset: select,
	downloadTrackTournamentLobbyAsset: async () => new Uint8Array(),
	TRACK_TOURNAMENT_TYPE: { weekly: 0, monthly: 1 },
}))
const { TournamentAssets } = await import('./tournamentAssets')
test('asset selection remains isolated by weekly/monthly tournament type', async () => {
	for (const [type, expected] of [
		['weekly', 0],
		['monthly', 1],
	] as const) {
		select.mockClear()
		const provider = new TournamentAssets(
			type,
			new LevelPayloadCache(),
			{ info: () => {}, warn: () => {} },
			{},
		)
		expect(await provider.refresh()).toBeUndefined()
		expect(select).toHaveBeenCalledWith(expected)
		provider.stop()
	}
})
