import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import { z } from 'zod'

export const nodeEnvSchema = z.enum(['development', 'test', 'production']).default('development')

export type EnvSource = Record<string, string | undefined>

export function parseDuration(input: string): number {
	if (/^\d+$/.test(input)) {
		return Number(input)
	}

	const match = input.match(/^(\d+)(ms|s|m|h|d)$/)
	if (!match) {
		throw new Error(`Invalid duration: ${input}`)
	}

	const [, rawValue, unit] = match
	const value = Number(rawValue)

	switch (unit) {
		case 'ms':
			return value
		case 's':
			return value * 1_000
		case 'm':
			return value * 60_000
		case 'h':
			return value * 3_600_000
		case 'd':
			return value * 86_400_000
		default:
			throw new Error(`Unsupported duration unit: ${unit}`)
	}
}

export function resolvePath(value: string): string {
	if (isAbsolute(value)) {
		return value
	}

	return resolve(process.cwd(), value)
}

export function resolveConfiguredPath({
	value,
	candidates,
}: {
	value?: string
	candidates: string[]
}): string {
	if (value) {
		return resolvePath(value)
	}

	const existingPath = candidates.find((candidate) => existsSync(candidate))
	return existingPath ?? candidates[0] ?? resolve(process.cwd())
}

export function readRootEnvValue(name: string): string | undefined {
	const rootEnvPath = resolve(process.cwd(), '../../.env')
	if (!existsSync(rootEnvPath)) {
		return undefined
	}

	for (const line of readFileSync(rootEnvPath, 'utf8').split(/\r?\n/)) {
		if (line.startsWith(`${name}=`)) {
			return line.slice(name.length + 1).trim()
		}
	}

	return undefined
}

export function requireStrongProductionSecrets({
	nodeEnv,
	jwtSecret,
	triggerJobToken,
}: {
	nodeEnv: string
	jwtSecret: string
	triggerJobToken: string
}): void {
	if (nodeEnv !== 'production') {
		return
	}

	const weakValues = new Set(['replace-me', 'trigger-token', 'job-secret'])
	if (weakValues.has(triggerJobToken) || triggerJobToken.length < 32) {
		throw new Error('TRIGGER_JOB_TOKEN must contain at least 32 non-placeholder characters')
	}
	if (weakValues.has(jwtSecret)) {
		throw new Error('JWT_SECRET must not use a placeholder value')
	}
}
