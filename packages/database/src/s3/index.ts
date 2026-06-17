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

export async function uploadFile(fileName: string, file: Buffer): Promise<void> {
	const s3File = client.file(fileName)

	try {
		await s3File.write(file, {
			type: 'application/octet-stream',
		})
	} catch (error) {
		console.error('Error uploading file to S3:', error)
	}
}
