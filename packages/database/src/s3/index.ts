import { SpanKind, withActiveSpan } from '@zeepkist/telemetry'
import { S3Client } from 'bun'
import {
	WASABI_ACCESSKEY,
	WASABI_BUCKET,
	WASABI_ENDPOINT,
	WASABI_REGION,
	WASABI_SECRETKEY,
} from '../config'

const client = new S3Client({
	accessKeyId: WASABI_ACCESSKEY,
	secretAccessKey: WASABI_SECRETKEY,
	bucket: WASABI_BUCKET,
	endpoint: WASABI_ENDPOINT,
	region: WASABI_REGION,
	acl: 'private',
})

export async function uploadFile(
	fileName: string,
	file: Uint8Array | Blob | Response | ReadableStream<Uint8Array>,
	contentType = 'application/octet-stream',
): Promise<void> {
	return withActiveSpan('s3.upload', { kind: SpanKind.CLIENT }, async (span) => {
		span.addEvent('s3.upload.request', {
			's3.content_type': contentType,
			...(file instanceof Uint8Array
				? { 's3.body.size': file.byteLength }
				: file instanceof Blob
					? { 's3.body.size': file.size }
					: {}),
		})
		const s3File = client.file(fileName)
		const writer = s3File.writer({
			type: contentType,
			retry: 4,
			queueSize: 1,
			partSize: 5 * 1024 * 1024,
		})
		try {
			if (file instanceof Uint8Array) {
				await writer.write(file)
				await writer.end()
				return
			}
			const stream =
				file instanceof Blob ? file.stream() : file instanceof Response ? file.body : file
			if (!stream) throw new Error('Upload body stream is unavailable')
			for await (const chunk of stream) await writer.write(chunk as Uint8Array<ArrayBuffer>)
			await writer.end()
		} catch (error) {
			const closableWriter = writer as unknown as { close(): void }
			closableWriter.close()
			throw error
		}
	})
}

export async function deleteFile(fileName: string): Promise<void> {
	await withActiveSpan('s3.delete', { kind: SpanKind.CLIENT }, () =>
		client.file(fileName).delete(),
	)
}

export async function downloadFile(
	fileName: string,
	{
		maxBytes,
		expectedBytes,
		expectedSha256,
	}: { maxBytes: number; expectedBytes?: number; expectedSha256?: string },
): Promise<Uint8Array> {
	return withActiveSpan('s3.download', { kind: SpanKind.CLIENT }, async (span) => {
		const file = client.file(fileName)
		const metadata = await file.stat()
		span.addEvent('s3.object.metadata', { 's3.object.size': metadata.size })
		if (!Number.isSafeInteger(metadata.size) || metadata.size > maxBytes || metadata.size < 0) {
			throw new Error(`S3 object exceeds ${maxBytes} bytes`)
		}
		if (expectedBytes !== undefined && metadata.size !== expectedBytes) {
			throw new Error('S3 object size does not match expected bytes')
		}

		const bytes = new Uint8Array(metadata.size)
		if (expectedSha256 && !/^[0-9a-f]{64}$/i.test(expectedSha256)) {
			throw new Error('Expected S3 SHA256 is invalid')
		}
		const hasher = expectedSha256 ? new Bun.CryptoHasher('sha256') : null
		let offset = 0
		for await (const chunk of file.stream()) {
			if (offset + chunk.byteLength > bytes.byteLength) {
				throw new Error('S3 object exceeded declared size while streaming')
			}
			bytes.set(chunk, offset)
			hasher?.update(chunk)
			offset += chunk.byteLength
		}
		if (offset !== bytes.byteLength) throw new Error('S3 object ended before declared size')
		if (hasher && hasher.digest('hex') !== expectedSha256?.toLowerCase()) {
			throw new Error('S3 object SHA256 does not match expected digest')
		}
		return bytes
	})
}
