import { config } from '@zeepkist/core'
import { WorkshopScanner } from '@zeepkist/workshop/scanner'
import { SteamCmdDownloader } from '@zeepkist/workshop/steam-cmd'
import { SteamWebApiMetadata } from '@zeepkist/workshop/steam-metadata'

let scanner: WorkshopScanner | undefined
let metadata: SteamWebApiMetadata | undefined

export function getWorkshopMetadata(): SteamWebApiMetadata {
	metadata ??= new SteamWebApiMetadata(config.steam.apiKey ?? '', config.steam.appId)
	return metadata
}

export function getWorkshopScanner(): WorkshopScanner {
	scanner ??= new WorkshopScanner(
		getWorkshopMetadata(),
		new SteamCmdDownloader(config.steam.appId),
	)
	return scanner
}
