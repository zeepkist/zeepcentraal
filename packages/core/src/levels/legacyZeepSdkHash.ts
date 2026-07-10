import { presentBlockId } from './utils'
import { xxHash128Hex } from './xxhash'

const legacyNumberKey = '__zeepcentraalLegacyJsonNumber'
const maxLegacyDecimalInteger = '79228162514264337593543950335'

interface LegacyNumberWrapper {
	[legacyNumberKey]: string
}

interface JsonBlock {
	i?: number | LegacyNumberWrapper
	[key: string]: unknown
}

interface JsonLevel {
	blox?: JsonBlock[]
}

function isLegacyNumberWrapper(value: unknown): value is LegacyNumberWrapper {
	return (
		typeof value === 'object' &&
		value !== null &&
		Object.keys(value).length === 1 &&
		typeof (value as Record<string, unknown>)[legacyNumberKey] === 'string'
	)
}

function isJsonIdentifierCharacter(character: string | undefined): boolean {
	return character !== undefined && /[A-Za-z0-9_$]/.test(character)
}

function bareTokenLength(content: string, index: number, token: string): number | null {
	if (!content.startsWith(token, index)) {
		return null
	}
	if (
		isJsonIdentifierCharacter(content[index - 1]) ||
		isJsonIdentifierCharacter(content[index + token.length])
	) {
		return null
	}
	return token.length
}

function wrapJsonNumbers(content: string): string {
	let wrapped = ''
	let inString = false
	let escaped = false
	for (let index = 0; index < content.length; index++) {
		const character = content[index]
		if (inString) {
			wrapped += character
			if (escaped) {
				escaped = false
			} else if (character === '\\') {
				escaped = true
			} else if (character === '"') {
				inString = false
			}
			continue
		}
		if (character === '"') {
			inString = true
			wrapped += character
			continue
		}

		const nonFiniteLength =
			bareTokenLength(content, index, '-Infinity') ??
			bareTokenLength(content, index, 'Infinity') ??
			bareTokenLength(content, index, 'NaN')
		if (nonFiniteLength !== null) {
			wrapped += `{"${legacyNumberKey}":"0"}`
			index += nonFiniteLength - 1
			continue
		}

		const number = content.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/)
		if (number) {
			wrapped += `{"${legacyNumberKey}":"${number[0]}"}`
			index += number[0].length - 1
			continue
		}

		wrapped += character
	}
	return wrapped
}

function roundFixedDecimal(integer: string, fraction: string, scale: number): string {
	if (fraction.length <= scale) {
		const normalizedInteger = integer.replace(/^0+(?=\d)/, '') || '0'
		const normalizedFraction = fraction.replace(/0+$/, '')
		return normalizedFraction ? `${normalizedInteger}.${normalizedFraction}` : normalizedInteger
	}

	const keptFraction = fraction.slice(0, scale)
	const roundDigit = fraction[scale] ?? '0'
	const combined = `${integer}${keptFraction}`.replace(/^0+/, '') || '0'
	const rounded = (BigInt(combined) + (roundDigit >= '5' ? 1n : 0n)).toString()
	const padded = rounded.padStart(scale + 1, '0')
	const roundedInteger = padded.slice(0, -scale).replace(/^0+(?=\d)/, '') || '0'
	const roundedFraction = padded.slice(-scale).replace(/0+$/, '')
	return roundedFraction ? `${roundedInteger}.${roundedFraction}` : roundedInteger
}

function rawNumberToFixedDecimal(raw: string): string {
	const negative = raw.startsWith('-')
	const unsigned = negative ? raw.slice(1) : raw
	const numberParts = unsigned.split(/[eE]/)
	const mantissa = numberParts[0] ?? '0'
	const exponentText = numberParts[1] ?? '0'
	const exponent = Number.parseInt(exponentText, 10)
	const mantissaParts = mantissa.split('.')
	const integerPart = mantissaParts[0] ?? '0'
	const fractionPart = mantissaParts[1] ?? ''
	const digits = `${integerPart}${fractionPart}`.replace(/^0+/, '') || '0'
	const significantInteger = integerPart.replace(/^0+/, '')
	const leadingFractionZeroes = significantInteger
		? 0
		: (fractionPart.match(/^0*/)?.[0].length ?? 0)
	const point =
		(significantInteger ? significantInteger.length : -leadingFractionZeroes) + exponent
	const integer =
		point <= 0
			? '0'
			: point >= digits.length
				? `${digits}${'0'.repeat(point - digits.length)}`
				: digits.slice(0, point)
	const fraction =
		point <= 0
			? `${'0'.repeat(-point)}${digits}`
			: point >= digits.length
				? ''
				: digits.slice(point)
	const fixed = roundFixedDecimal(integer, fraction, 28)
	if (fixed === '0') {
		return '0'
	}
	return negative ? `-${fixed}` : fixed
}

function assertLegacyDecimalRange(fixed: string): void {
	const unsigned = fixed.startsWith('-') ? fixed.slice(1) : fixed
	const integer = (unsigned.split('.')[0] ?? '0').replace(/^0+/, '') || '0'
	if (
		integer.length > maxLegacyDecimalInteger.length ||
		(integer.length === maxLegacyDecimalInteger.length && integer > maxLegacyDecimalInteger)
	) {
		throw new Error(`JSON number is outside legacy ZeepSDK decimal range: ${fixed}`)
	}
}

function legacyZeepSdkNumber(raw: string): string {
	const fixed = rawNumberToFixedDecimal(raw)
	if (fixed === '0' || fixed === '-0') {
		return '0'
	}
	assertLegacyDecimalRange(fixed)

	const absolute = Math.abs(Number(fixed))
	if (absolute !== 0 && absolute < 0.000001) {
		const negative = fixed.startsWith('-')
		const digits = fixed.replace(/^-?0\./, '')
		const leadingZeroes = digits.match(/^0*/)?.[0].length ?? 0
		const significant = digits.slice(leadingZeroes).replace(/0+$/, '')
		if (!significant) {
			return '0'
		}
		const mantissa =
			significant.length === 1 ? significant : `${significant[0]}.${significant.slice(1)}`
		return `${negative ? '-' : ''}${mantissa}e-${leadingZeroes + 1}`
	}

	return fixed
}

function canonicalLegacyZeepSdkJson(value: unknown): string {
	if (isLegacyNumberWrapper(value)) {
		return legacyZeepSdkNumber(value[legacyNumberKey])
	}
	if (value === null || typeof value === 'boolean') {
		return JSON.stringify(value)
	}
	if (typeof value === 'number') {
		return legacyZeepSdkNumber(String(value))
	}
	if (typeof value === 'string') {
		return JSON.stringify(value)
	}
	if (Array.isArray(value)) {
		return `[${value.map(canonicalLegacyZeepSdkJson).join(',')}]`
	}
	if (typeof value === 'object' && value !== null) {
		return `{${Object.keys(value)
			.sort()
			.map(
				(key) =>
					`${JSON.stringify(key)}:${canonicalLegacyZeepSdkJson((value as Record<string, unknown>)[key])}`,
			)
			.join(',')}}`
	}
	throw new Error(`JSON level contains unsupported value: ${String(value)}`)
}

function blockId(block: JsonBlock): number | undefined {
	return isLegacyNumberWrapper(block.i) ? Number(block.i[legacyNumberKey]) : block.i
}

function canonicalLegacyZeepSdkBlocks(content: string): string {
	const wrapped = wrapJsonNumbers(content.replace(/^\uFEFF/, ''))
	const parsed = JSON.parse(wrapped) as JsonLevel
	if (!Array.isArray(parsed.blox)) {
		throw new Error('JSON level is missing blox')
	}
	const blocks = parsed.blox
	return `[${blocks
		.filter((block) => blockId(block) !== presentBlockId)
		.map((block, index) => ({
			block,
			index,
			canonical: canonicalLegacyZeepSdkJson(block),
		}))
		.sort(
			(left, right) =>
				(left.canonical < right.canonical
					? -1
					: left.canonical > right.canonical
						? 1
						: 0) || left.index - right.index,
		)
		.map((entry) => entry.canonical)
		.join(',')}]`
}

export function calculateLegacyZeepSdkJsonXxHash(content: string): string {
	return xxHash128Hex(canonicalLegacyZeepSdkBlocks(content))
}
