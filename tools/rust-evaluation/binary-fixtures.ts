import { BitWriter } from '../../packages/core/src/zeepnet/binary'

const cases = [true, false].map((aligned) => {
	const writer = new BitWriter()
	if (!aligned) writer.writeBoolean(true)
	writer.writeUInt16(65535)
	writer.writeInt32(-2147483648)
	writer.writeUInt32(4294967295)
	writer.writeUInt64(18446744073709551615n)
	writer.writeInt64(-9223372036854775808n)
	writer.writeFloat32(1.25)
	writer.writeFloat64(-123.125)
	writer.writeVariableUInt32(4294967295)
	writer.writeString('Zeep 🚗')
	return { aligned, bits: writer.bitLength, bytes: [...writer.toUint8Array()] }
})
const path = new URL('../../crates/core/fixtures/binary.json', import.meta.url)
const content = `${JSON.stringify(cases, null, '\t')}\n`
if (process.argv.includes('--check')) {
	if (JSON.stringify(await Bun.file(path).json()) !== JSON.stringify(cases))
		throw new Error('Binary fixtures differ from TypeScript')
} else {
	await Bun.write(path, content)
}
