import { describe, expect, test } from 'bun:test'
import {
	canSteamCmdDownloadWorkshopItem,
	isSteamWorkshopItemAccessible,
	STEAM_ACCESSIBLE_VISIBILITIES,
	STEAM_VISIBILITY,
} from './visibility'

describe('Steam workshop visibility', () => {
	test('defines public and unlisted items as accessible', () => {
		expect(STEAM_ACCESSIBLE_VISIBILITIES).toEqual([
			STEAM_VISIBILITY.Public,
			STEAM_VISIBILITY.Unlisted,
		])
		expect(isSteamWorkshopItemAccessible(STEAM_VISIBILITY.Public)).toBe(true)
		expect(isSteamWorkshopItemAccessible(STEAM_VISIBILITY.Unlisted)).toBe(true)
	})

	test('defines friends-only and hidden items as inaccessible', () => {
		expect(isSteamWorkshopItemAccessible(STEAM_VISIBILITY.FriendsOnly)).toBe(false)
		expect(isSteamWorkshopItemAccessible(STEAM_VISIBILITY.Hidden)).toBe(false)
	})

	test('marks public and unlisted items as SteamCMD-downloadable', () => {
		expect(canSteamCmdDownloadWorkshopItem(STEAM_VISIBILITY.Public)).toBe(true)
		expect(canSteamCmdDownloadWorkshopItem(STEAM_VISIBILITY.Unlisted)).toBe(true)
	})

	test('marks friends-only and hidden items as inaccessible to SteamCMD', () => {
		expect(canSteamCmdDownloadWorkshopItem(STEAM_VISIBILITY.FriendsOnly)).toBe(false)
		expect(canSteamCmdDownloadWorkshopItem(STEAM_VISIBILITY.Hidden)).toBe(false)
	})
})
