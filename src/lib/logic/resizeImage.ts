/** Long side of an uploaded photo: big enough to read handwriting, small enough to send fast. */
const MAX_SIDE = 1568;

/**
 * A picked photo as base64 JPEG (no `data:` prefix), scaled down so its long
 * side is at most `MAX_SIDE`. iOS hands HEIC photos over already decodable,
 * and drawing to a canvas drops the EXIF location along the way.
 */
export async function photoToJpegBase64(file: Blob, quality = 0.8): Promise<string> {
	const bitmap = await createImageBitmap(file);
	const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
	const canvas = document.createElement('canvas');
	canvas.width = Math.round(bitmap.width * scale);
	canvas.height = Math.round(bitmap.height * scale);
	canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	bitmap.close();

	const blob = await new Promise<Blob>((resolve, reject) =>
		canvas.toBlob(
			(b) => (b ? resolve(b) : reject(new Error('encode failed'))),
			'image/jpeg',
			quality
		)
	);
	const bytes = new Uint8Array(await blob.arrayBuffer());
	let binary = '';
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	}
	return btoa(binary);
}
