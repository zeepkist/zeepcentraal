import { jobsConfig } from '@zeepkist/core/config/jobs'
import { WorkshopScanner } from '@zeepkist/workshop/scanner'
import { SteamCmdDownloader } from '@zeepkist/workshop/steam-cmd'
import { SteamWebApiMetadata } from '@zeepkist/workshop/steam-metadata'

let scanner: WorkshopScanner | undefined
let metadata: SteamWebApiMetadata | undefined

export function getWorkshopMetadata(): SteamWebApiMetadata {
	metadata ??= new SteamWebApiMetadata(jobsConfig.steam.apiKey ?? '', jobsConfig.steam.appId)
	return metadata
}

export function getWorkshopScanner(): WorkshopScanner {
	scanner ??= new WorkshopScanner(
		getWorkshopMetadata(),
		new SteamCmdDownloader(jobsConfig.steam.appId),
	)
	return scanner
}
