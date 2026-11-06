// Synthetic V7 protobuf: initial position (0, 2, 0), rotation (0, 90, 0).
// Zero axes are omitted on wire. Three deltas trace (14, 2, 0), (14, 2, 14),
// and (28, 2, 14) at 14, 28, and 42 seconds. Rotation carries across deltas.
export const ghostPlaybackPayload = Buffer.from(
	'CAciDgoFFQAAAEASBRUAALRCKgsNAABgQRIECMC5VSoLDQAA4EESBBjAuVUqCw0AAChCEgQIwLlV',
	'base64',
)

// Same payload compressed using LZMA-alone, matching production ghost downloads.
export const ghostPlaybackLzma = Buffer.from(
	'XQAAgAD//////////wAEAexfJLYa/vHHSJF4pcTc8FsYu+4N98nG7atVpwj/Gjf2cjG3m5dL9Uv//7EiAAA=',
	'base64',
)
