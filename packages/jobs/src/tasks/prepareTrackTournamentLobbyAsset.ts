import { jobsConfig } from '@zeepkist/core/config/jobs'
import { levelFormat } from '@zeepkist/core/levels'
import { decodeZeepkistLevelPayload, encodeZeepkistLevelPayload } from '@zeepkist/core/zeepnet'
import {
	getTrackTournamentLobbyAssetSources,
	publishTrackTournamentLobbyAsset,
} from '@zeepkist/database'
import { findWorkshopLevelFile } from '@zeepkist/workshop/level-files'
import { SteamCmdDownloader } from '@zeepkist/workshop/steam-cmd'
import type { TaskHandler } from './types'

type Payload = { idTournament: number }

export const prepareTrackTournamentLobbyAsset: TaskHandler<Payload> = async (
	{ idTournament },
	helpers,
) => {
	const sources = await getTrackTournamentLobbyAssetSources(idTournament)
	if (sources.length === 0) throw new Error('Weekly tournament has no downloadable level item')
	const downloader = new SteamCmdDownloader(jobsConfig.steam.appId, jobsConfig.steam.cmdPath)
	let lastError: unknown

	for (const source of sources) {
		try {
			await using download = await downloader.download([source.workshopId])
			const item = download.items[0]
			if (!item) throw new Error('SteamCMD returned no workshop item')
			const levelFile = await findWorkshopLevelFile(item.directory, source.fileUid)
			if (!levelFile) throw new Error('Workshop item omitted selected level UID')
			const payload = encodeZeepkistLevelPayload(
				levelFile.content,
				source.format === levelFormat.json,
			)
			if (decodeZeepkistLevelPayload(payload).length === 0) {
				throw new Error('Prepared level payload is empty')
			}
			const contentSha256 = new Bun.CryptoHasher('sha256').update(payload).digest('hex')
			const objectKey = `track-tournament-lobby/${idTournament}/${contentSha256}.gz`
			await publishTrackTournamentLobbyAsset(
				{
					idTournament,
					workshopId: source.workshopId,
					fileUid: source.fileUid,
					levelName: source.levelName || levelFile.name,
					author: source.fileAuthor,
					collaborators: '',
					overrideAuthorName: '',
					objectKey,
					contentSha256,
					byteSize: payload.length,
				},
				payload,
			)
			helpers.logger.info('Prepared weekly tournament lobby asset.', {
				byteSize: payload.length,
				idTournament,
				workshopId: source.workshopId.toString(),
			})
			return
		} catch (error) {
			lastError = error
		}
	}
	throw lastError instanceof Error
		? new Error(`Unable to prepare tournament lobby asset: ${lastError.message}`)
		: new Error('Unable to prepare tournament lobby asset')
}
