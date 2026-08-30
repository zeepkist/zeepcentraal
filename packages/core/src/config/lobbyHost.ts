import { z } from 'zod'
import { type EnvSource, nodeEnvSchema } from './shared'

const roomKeySchema = z.string().regex(/^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/)
const roomNameSchema = z
	.string()
	.trim()
	.min(1)
	.max(256)
	.refine((value) => new TextEncoder().encode(value).byteLength <= 256, {
		message: 'Room name must not exceed 256 UTF-8 bytes',
	})

const managedRoomSchema = z.strictObject({
	key: roomKeySchema,
	profile: z.strictObject({
		type: z.literal('track-tournament'),
		tournamentType: z.enum(['weekly', 'monthly']),
	}),
	room: z.strictObject({
		name: roomNameSchema,
		isPublic: z.boolean(),
		maxPlayers: z.number().int().min(2).max(64),
	}),
	roundTimeSeconds: z.number().int().min(60).max(3_600),
	assetPollMs: z
		.number()
		.int()
		.min(5_000)
		.max(30 * 60_000),
	reconnectMaxMs: z
		.number()
		.int()
		.min(5_000)
		.max(10 * 60_000),
	messageRefreshMs: z
		.number()
		.int()
		.min(60_000)
		.max(30 * 60_000),
})

const lobbyHostFileSchema = z
	.strictObject({
		version: z.literal(1),
		rooms: z.array(managedRoomSchema).min(1).max(32),
	})
	.superRefine(({ rooms }, context) => {
		const keys = new Set<string>()
		for (const [index, room] of rooms.entries()) {
			if (keys.has(room.key)) {
				context.addIssue({
					code: 'custom',
					message: `Duplicate managed room key: ${room.key}`,
					path: ['rooms', index, 'key'],
				})
			}
			keys.add(room.key)
		}
	})

const lobbyHostEnvSchema = z.object({
	NODE_ENV: nodeEnvSchema,
	ZEEPKIST_LOBBY_HOST_ENABLED: z.stringbool().default(false),
	ZEEPKIST_LOBBY_HOST_CONFIG_FILE: z.string().min(1).optional(),
	ZEEPKIST_ROOM_BROKER_URL: z.url().default('http://localhost:3001'),
	ZEEPKIST_ROOM_BROKER_TOKEN: z.string().min(32).optional(),
	ZEEPKIST_LOBBY_HOST_GRAPHQL_WS_URL: z.url().default('ws://localhost:5000'),
	OPENTELEMETRY_SERVICE_NAME: z.string().optional(),
	OPENTELEMETRY_SERVICE_VERSION: z.string().optional(),
	OPENTELEMETRY_COLLECTOR_URL: z.string().default('http://localhost:4317'),
})

export type ManagedRoomConfig = z.infer<typeof managedRoomSchema>
export type LobbyHostFileConfig = z.infer<typeof lobbyHostFileSchema>

export function parseLobbyHostFileConfig(value: unknown): LobbyHostFileConfig {
	return lobbyHostFileSchema.parse(value)
}

export function parseLobbyHostConfig(env: EnvSource) {
	const parsed = lobbyHostEnvSchema.parse(env)
	if (parsed.ZEEPKIST_LOBBY_HOST_ENABLED && !parsed.ZEEPKIST_ROOM_BROKER_TOKEN) {
		throw new Error('ZEEPKIST_ROOM_BROKER_TOKEN is required when lobby host is enabled')
	}
	if (parsed.ZEEPKIST_LOBBY_HOST_ENABLED && !parsed.ZEEPKIST_LOBBY_HOST_CONFIG_FILE) {
		throw new Error('ZEEPKIST_LOBBY_HOST_CONFIG_FILE is required when lobby host is enabled')
	}
	return {
		enabled: parsed.ZEEPKIST_LOBBY_HOST_ENABLED,
		configFile: parsed.ZEEPKIST_LOBBY_HOST_CONFIG_FILE,
		brokerUrl: parsed.ZEEPKIST_ROOM_BROKER_URL.replace(/\/$/, ''),
		brokerToken: parsed.ZEEPKIST_ROOM_BROKER_TOKEN,
		graphqlWsUrl: parsed.ZEEPKIST_LOBBY_HOST_GRAPHQL_WS_URL,
		nodeEnv: parsed.NODE_ENV,
		otel: {
			collectorUrl: parsed.OPENTELEMETRY_COLLECTOR_URL,
			serviceName: parsed.OPENTELEMETRY_SERVICE_NAME,
			serviceVersion: parsed.OPENTELEMETRY_SERVICE_VERSION,
		},
	} as const
}

export const lobbyHostConfig = parseLobbyHostConfig(process.env)
