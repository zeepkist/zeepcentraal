import { describe, expect, test } from 'bun:test'
import * as rich from './richText'

describe('Unity rich text', () => {
	test.each([
		[rich.bold, 'b'],
		[rich.italic, 'i'],
		[rich.underline, 'u'],
		[rich.strikethrough, 's'],
		[rich.allcaps, 'allcaps'],
		[rich.uppercase, 'uppercase'],
		[rich.lowercase, 'lowercase'],
		[rich.smallcaps, 'smallcaps'],
		[rich.subscript, 'sub'],
		[rich.superscript, 'sup'],
		[rich.noBreak, 'nobr'],
		[rich.noParse, 'noparse'],
	] as const)('%s wraps text', (helper, tag) => {
		expect(helper('text')).toBe(`<${tag}>text</${tag}>`)
		expect(helper('')).toBe(`<${tag}></${tag}>`)
	})

	test.each([
		[rich.align('center', 'x'), '<align="center">x</align>'],
		[rich.color('#FFD700', 'x'), '<color=#FFD700>x</color>'],
		[rich.characterSpacing('-0.5em', 'x'), '<cspace=-0.5em>x</cspace>'],
		[rich.font('Impact SDF', 'x'), '<font="Impact SDF">x</font>'],
		[rich.fontWeight(700, 'x'), '<font-weight=700>x</font-weight>'],
		[rich.gradient('Light to Dark', 'x'), '<gradient="Light to Dark">x</gradient>'],
		[rich.indent('15%', 'x'), '<indent=15%>x</indent>'],
		[rich.lineHeight('50%', 'x'), '<line-height=50%>x</line-height>'],
		[rich.lineIndent(15, 'x'), '<line-indent=15>x</line-indent>'],
		[rich.margin('5em', 'x'), '<margin=5em>x</margin>'],
		[rich.mark('#ffff00aa', 'x'), '<mark=#ffff00aa>x</mark>'],
		[rich.monospace('2.75em', 'x'), '<mspace=2.75em>x</mspace>'],
		[rich.rotate(-45, 'x'), '<rotate=-45>x</rotate>'],
		[rich.size(65, 'x'), '<size=65%>x</size>'],
		[rich.style('H1', 'x'), '<style="H1">x</style>'],
		[rich.verticalOffset('-0.5em', 'x'), '<voffset=-0.5em>x</voffset>'],
		[rich.width('60%', 'x'), '<width=60%>x</width>'],
		[rich.lineBreak(), '<br>'],
		[rich.alpha('#CC'), '<alpha=#CC>'],
		[rich.position('75%'), '<pos=75%>'],
		[rich.space('5em'), '<space=5em>'],
		[rich.sprite('spriteName'), '<sprite name="spriteName">'],
		[rich.marginLeft(5), '<margin-left=5>'],
		[rich.marginRight('5px'), '<margin-right=5px>'],
	])('serializes %s', (actual, expected) => expect(actual).toBe(expected))

	test('composes without escaping markup or double-escaping user text', () => {
		expect(rich.size(65, rich.bold('nested'))).toBe('<size=65%><b>nested</b></size>')
		expect(rich.bold(rich.escapeText('<b>A&B</b>'))).toBe('<b>&lt;b&gt;A&amp;B&lt;/b&gt;</b>')
		expect(rich.noParse('<b>x</b>')).toBe('<noparse><b>x</b></noparse>')
	})
	test.each(['18px', '1.5em', '80%', '+1', '-1', '0'] as const)('size supports %s', (value) => {
		expect(rich.size(value, 'x')).toBe(`<size=${value}>x</size>`)
	})
	test.each(['left', 'center', 'right', 'justified', 'flush'] as const)(
		'alignment %s',
		(value) => {
			expect(rich.align(value, 'x')).toBe(`<align="${value}">x</align>`)
		},
	)
	test('named colors and transparent hex colors', () => {
		expect(rich.color('red', 'x')).toBe('<color=red>x</color>')
		expect(rich.color('#FF000088', 'x')).toBe('<color=#FF000088>x</color>')
	})
	test('rejects invalid numbers, units, colors and injected attributes', () => {
		for (const value of [NaN, Infinity, -Infinity]) {
			expect(() => rich.size(value, 'x')).toThrow()
			expect(() => rich.rotate(value, 'x')).toThrow()
			expect(() => rich.indent(value, 'x')).toThrow()
		}
		for (const value of ['', '1rem', '1e9', '5px><b', '1 2', 'Infinity']) {
			expect(() => rich.size(value as rich.Dimension, 'x')).toThrow()
		}
		for (const value of ['', '" /><b>', 'a\nb', '<sprite>', "a'b"]) {
			for (const helper of [rich.font, rich.gradient, rich.style])
				expect(() => helper(value, 'x')).toThrow()
			expect(() => rich.sprite(value)).toThrow()
		}
		for (const value of ['#FFF', '#GGGGGG', 'red><b', 'unknown']) {
			expect(() => rich.color(value, 'x')).toThrow()
			expect(() => rich.mark(value, 'x')).toThrow()
		}
		expect(() => rich.alpha('#FFFF')).toThrow()
		expect(() => rich.alpha('#ZZ')).toThrow()
		expect(() => rich.align('bad' as rich.Alignment, 'x')).toThrow()
		expect(() => rich.fontWeight(750 as rich.FontWeight, 'x')).toThrow()
		for (const helper of [rich.characterSpacing, rich.monospace, rich.verticalOffset])
			expect(() => helper('5%', 'x')).toThrow()
		expect(() => rich.space('5%')).toThrow()
	})
})
