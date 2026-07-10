import { describe, expect, test } from 'bun:test'
import { canSteamCmdDownloadWorkshopItem, STEAM_VISIBILITY } from './visibility'

describe('Steam workshop visibility', () => {
	test('marks public and unlisted items as SteamCMD-downloadable', () => {
		expect(canSteamCmdDownloadWorkshopItem(STEAM_VISIBILITY.Public)).toBe(true)
		expect(canSteamCmdDownloadWorkshopItem(STEAM_VISIBILITY.Unlisted)).toBe(true)
	})

	test('marks friends-only and hidden items as inaccessible to SteamCMD', () => {
		expect(canSteamCmdDownloadWorkshopItem(STEAM_VISIBILITY.FriendsOnly)).toBe(false)
		expect(canSteamCmdDownloadWorkshopItem(STEAM_VISIBILITY.Hidden)).toBe(false)
	})
})
