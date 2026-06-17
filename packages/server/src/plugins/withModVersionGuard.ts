import { isModOutdated } from '@zeepkist/database/services';
import { setAttributes } from '@elysiajs/opentelemetry';
import type { Elysia } from 'elysia';
import { V1_ERROR_CODES, handleV1Error } from '../v1Errors';

const HEADER = {
	zeepkistVersion: 'x-zeepkist-version',
	zeepkistMajorVersion: 'x-zeepkist-major-version',
	gtrVersion: 'x-gtr-version',
	steamId: 'x-steam-id',
} as const;

const ATTRIBUTE = {
	zeepkistVersion: 'mod.zeepkistVersion',
	zeepkistMajorVersion: 'mod.zeepkistMajorVersion',
	version: 'mod.version',
	steamId: 'mod.steamId',
	outdated: 'mod.outdated',
} as const;

type GuardPayload = {
	ModVersion?: string;
	GameVersion?: string;
	SteamId?: string;
};

type GuardAuth = {
	steamId?: string;
	steamid?: string;
};

function firstString(...values: unknown[]): string | undefined {
	for (const value of values) {
		if (typeof value === 'string' && value.length > 0) {
			return value;
		}
	}

	return undefined;
}

export const withModVersionGuard = (app: Elysia) =>
	app.derive(async (context) => {
		const { body, headers, status } = context;
		const payload = (body ?? {}) as GuardPayload;
		const authPayload = ((context as { auth?: GuardAuth }).auth ?? {}) as GuardAuth;

		const zeepkistVersion = firstString(headers[HEADER.zeepkistVersion]);
		const zeepkistMajorVersion = firstString(
			headers[HEADER.zeepkistMajorVersion],
			payload.GameVersion,
		);
		const modVersion = firstString(headers[HEADER.gtrVersion], payload.ModVersion);
		const steamId = firstString(
			headers[HEADER.steamId],
			payload.SteamId,
			authPayload.steamId,
			authPayload.steamid,
		);

		const attributes: Record<string, string> = {};

		if (zeepkistVersion) {
			attributes[ATTRIBUTE.zeepkistVersion] = zeepkistVersion;
		}
		if (zeepkistMajorVersion) {
			attributes[ATTRIBUTE.zeepkistMajorVersion] = zeepkistMajorVersion;
		}
		if (modVersion) {
			attributes[ATTRIBUTE.version] = modVersion;
		}
		if (steamId) {
			attributes[ATTRIBUTE.steamId] = steamId;
		}

		if (!modVersion) {
			if (Object.keys(attributes).length > 0) {
				setAttributes(attributes);
			}
			return { modVersion };
		}

		const outdated = await isModOutdated(modVersion);

		attributes[ATTRIBUTE.outdated] = String(outdated);
		setAttributes(attributes);

		if (outdated) {
			return status(400, handleV1Error(V1_ERROR_CODES.AUTH_MOD_OUTDATED));
		}

		return {
			modVersion,
		};
	});
