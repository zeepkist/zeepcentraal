import { beforeEach, expect, mock, test } from 'bun:test'
import { decodeZeepkistLevelPayload } from '@zeepkist/core/zeepnet'

interface AssetMetadata {
	byteSize: number
	objectKey: string
}

interface FoundLevel {
	content: string
	fileUid: string
	name: string
	path: string
}

const getSources = mock(async () => [source(123n, 'uid-123')] as ReturnType<typeof source>[])
const publish = mock(async (_metadata: AssetMetadata, _payload: Uint8Array) => {})
const cleanup = mock(async () => {})
const download = mock(async (workshopIds: bigint[]) => ({
	items: [{ workshopId: workshopIds[0], directory: 'downloaded-item' }],
	cleanup,
	[Symbol.asyncDispose]: cleanup,
}))
const findLevel = mock(
	async () =>
		({
			content: '15,uid-123\nmetadata\n',
			fileUid: 'uid-123',
			name: 'Downloaded Track',
			path: 'downloaded-item/track.zeeplevel',
		}) as FoundLevel | undefined,
)

mock.module('@zeepkist/database', () => ({
	getTrackTournamentLobbyAssetSources: getSources,
	publishTrackTournamentLobbyAsset: publish,
}))
mock.module('@zeepkist/workshop/level-files', () => ({ findWorkshopLevelFile: findLevel }))
mock.module('@zeepkist/workshop/steam-cmd', () => ({
	SteamCmdDownloader: class {
		download = download
	},
}))

const { prepareTrackTournamentLobbyAsset } = await import('./prepareTrackTournamentLobbyAsset')

beforeEach(() => {
	getSources.mockClear()
	publish.mockClear()
	cleanup.mockClear()
	download.mockClear()
	findLevel.mockClear()
})

test('downloads, validates, hashes, and publishes immutable weekly asset', async () => {
	const info = mock(() => {})
	await prepareTrackTournamentLobbyAsset({ idTournament: 42 }, { logger: { info } } as never)
	expect(download).toHaveBeenCalledWith([123n])
	expect(findLevel).toHaveBeenCalledWith('downloaded-item', 'uid-123')
	expect(cleanup).toHaveBeenCalledTimes(1)
	expect(publish).toHaveBeenCalledTimes(1)
	const [metadata, payload] = publish.mock.calls[0] as [AssetMetadata, Uint8Array]
	expect(metadata.objectKey).toMatch(/^track-tournament-lobby\/42\/[0-9a-f]{64}\.gz$/)
	expect(metadata.byteSize).toBe(payload.length)
	expect(decodeZeepkistLevelPayload(payload)).toEqual(['15,uid-123', 'metadata', ''])
})

test('tries next public level item when first candidate fails', async () => {
	getSources.mockResolvedValueOnce([source(1n, 'missing'), source(2n, 'uid-2')])
	findLevel.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
		content: '15,uid-2\n',
		fileUid: 'uid-2',
		name: 'Fallback',
		path: 'downloaded-item/fallback.zeeplevel',
	})
	await prepareTrackTournamentLobbyAsset({ idTournament: 7 }, {
		logger: { info: () => {} },
	} as never)
	expect(download).toHaveBeenCalledTimes(2)
	expect(cleanup).toHaveBeenCalledTimes(2)
	expect(publish).toHaveBeenCalledTimes(1)
})
function source(workshopId: bigint, fileUid: string) {
	return {
		fileAuthor: 'Author',
		fileUid,
		format: 1,
		levelName: 'Track',
		workshopId,
	}
}
