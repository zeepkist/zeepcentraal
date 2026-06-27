import { expect, test } from 'bun:test'
import { superLeagueLevelUidToDatabaseFileUid, toDatabaseLevelFileUid } from './levelUidMap'

const expectedMappings: Array<[string, string]> = [
	['UkMpSTuFD0ipARO_Akane', 'Futuristic-bb_benji-01K848D1X4PDKPXYC5KZ05M8H1'],
	['Rwdbz4VK1kik8Aj_Akane', 'Futuristic-quickracer10-01K848D1X4PDKPXYC5KZ05M8GD'],
	[
		'Narrow-27022025-034738626-ttv_Lilly the Bun & Dragonshadow-842111177554-1576',
		'Narrow-27022025-034738626-ttv/Lilly the Bun & Dragonshadow-842111177554-1576',
	],
	[
		'Rollercoaster-02012025-184415514-ttv_Lilly the Bun & L3mmy-397865919511-1067',
		'Rollercoaster-02012025-184415514-ttv/Lilly the Bun & L3mmy-397865919511-1067',
	],
	[
		'Black n White-04122024-131308480-ttv_Lilly the Bun-757172990306-432',
		'Black n White-04122024-131308480-ttv/Lilly the Bun-757172990306-432',
	],
	[
		'Offroad Adventure-24072024-112803134-_void-324482009842-1161',
		'Offroad Adventure-24072024-112803134-//////void-324482009842-1161',
	],
	[
		'Fixed Checkpoints-26052024-190922404-[Bnuy]ttv_Lilly the Bun-200313995674-441',
		'Fixed Checkpoints-26052024-190922404-[Bnuy]ttv/Lilly the Bun-200313995674-441',
	],
	[
		'Racetrack-27032024-135821631-[RRG]ttv_Lilly the Bun-721709669997-2183',
		'Racetrack-27032024-135821631-[RRG]ttv/Lilly the Bun-721709669997-2183',
	],
	[
		'Wild West-24082023-094449498-[CTR]TheBamboozler-849772548280-1423.csv',
		'Wild West-24082023-094449498-[CTR]TheBamboozler-849772548280-1423',
	],
	[
		'15012023-233752924-ttv_jandjetv-045566035409-6281',
		'15012023-233752924-ttv/jandjetv-045566035409-6281',
	],
]

test('maps Super League level UIDs to database file UIDs', () => {
	expect(superLeagueLevelUidToDatabaseFileUid.size).toBe(expectedMappings.length)

	for (const [superLeagueUid, databaseUid] of expectedMappings) {
		expect(toDatabaseLevelFileUid(superLeagueUid)).toBe(databaseUid)
	}
})

test('keeps unknown Super League level UIDs unchanged', () => {
	expect(toDatabaseLevelFileUid('unchanged')).toBe('unchanged')
})
