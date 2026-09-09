/** Unity 2021.3 markup builders. Content is trusted markup; escapeText user text explicitly. */
export type Alignment = 'left' | 'center' | 'right' | 'justified' | 'flush'
export type Dimension = number | `${number}` | `${number}px` | `${number}em` | `${number}%`
export type FontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900

const wrap = (tag: string, text: string, value?: string) =>
	`<${tag}${value === undefined ? '' : `=${value}`}>${text}</${tag}>`
const single = (tag: string, value: string) => `<${tag}=${value}>`

function finite(value: number) {
	if (!Number.isFinite(value)) throw new TypeError('Rich-text number must be finite')
	return String(value)
}

function dimension(value: Dimension, percentage = true) {
	const raw = typeof value === 'number' ? finite(value) : value
	if (
		!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:px|em|%)?$/.test(raw) ||
		(!percentage && raw.endsWith('%')) ||
		!Number.isFinite(Number.parseFloat(raw))
	)
		throw new TypeError('Invalid rich-text dimension')
	return raw
}

function quoted(value: string) {
	if (!value.trim() || /["'<>\p{Cc}\p{Cf}]/u.test(value))
		throw new TypeError('Invalid rich-text asset name')
	return `"${value}"`
}

function tint(value: string) {
	if (
		!/^#(?:[\da-f]{6}|[\da-f]{8})$/i.test(value) &&
		!['black', 'blue', 'green', 'orange', 'purple', 'red', 'white', 'yellow'].includes(
			value.toLowerCase(),
		)
	)
		throw new TypeError('Invalid rich-text color')
	return value
}

export const bold = (text: string) => wrap('b', text)
export const italic = (text: string) => wrap('i', text)
export const underline = (text: string) => wrap('u', text)
export const strikethrough = (text: string) => wrap('s', text)
export const allcaps = (text: string) => wrap('allcaps', text)
export const uppercase = (text: string) => wrap('uppercase', text)
export const lowercase = (text: string) => wrap('lowercase', text)
export const smallcaps = (text: string) => wrap('smallcaps', text)
export const subscript = (text: string) => wrap('sub', text)
export const superscript = (text: string) => wrap('sup', text)
export const noBreak = (text: string) => wrap('nobr', text)
/** Not a sanitizer: embedded closing noparse tags still terminate the scope. */
export const noParse = (text: string) => wrap('noparse', text)
export function align(value: Alignment, text: string) {
	if (!['left', 'center', 'right', 'justified', 'flush'].includes(value))
		throw new TypeError('Invalid rich-text alignment')
	return wrap('align', text, `"${value}"`)
}
export const color = (value: string, text: string) => wrap('color', text, tint(value))
export const characterSpacing = (value: Dimension, text: string) =>
	wrap('cspace', text, dimension(value, false))
export const font = (value: string, text: string) => wrap('font', text, quoted(value))
export function fontWeight(value: FontWeight, text: string) {
	if (value < 100 || value > 900 || value % 100 !== 0)
		throw new TypeError('Invalid rich-text font weight')
	return wrap('font-weight', text, finite(value))
}
export const gradient = (value: string, text: string) => wrap('gradient', text, quoted(value))
export const indent = (value: Dimension, text: string) => wrap('indent', text, dimension(value))
export const lineHeight = (value: Dimension, text: string) =>
	wrap('line-height', text, dimension(value))
export const lineIndent = (value: Dimension, text: string) =>
	wrap('line-indent', text, dimension(value))
export const margin = (value: Dimension, text: string) => wrap('margin', text, dimension(value))
export const mark = (value: string, text: string) => wrap('mark', text, tint(value))
export const monospace = (value: Dimension, text: string) =>
	wrap('mspace', text, dimension(value, false))
export const rotate = (value: number, text: string) => wrap('rotate', text, finite(value))
export const size = (value: Dimension, text: string) =>
	wrap('size', text, typeof value === 'number' ? `${finite(value)}%` : dimension(value))
export const style = (value: string, text: string) => wrap('style', text, quoted(value))
export const verticalOffset = (value: Dimension, text: string) =>
	wrap('voffset', text, dimension(value, false))
export const width = (value: Dimension, text: string) => wrap('width', text, dimension(value))
export const lineBreak = () => '<br>'
/** Stateful: set a new opacity explicitly when a later segment needs another value. */
export function alpha(value: string) {
	if (!/^#[\da-f]{2}$/i.test(value)) throw new TypeError('Invalid rich-text opacity')
	return single('alpha', value)
}
export const position = (value: Dimension) => single('pos', dimension(value))
export const space = (value: Dimension) => single('space', dimension(value, false))
export const sprite = (name: string) => `<sprite name=${quoted(name)}>`
export const marginLeft = (value: Dimension) => single('margin-left', dimension(value))
export const marginRight = (value: Dimension) => single('margin-right', dimension(value))

export function escapeText(value: string) {
	return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}
