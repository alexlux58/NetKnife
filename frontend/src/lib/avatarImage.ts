/** Resize/compress an image file for profile avatar storage (DynamoDB data URL). */
const MAX_DATA_URL_CHARS = 250_000
const MAX_DIMENSION = 256

export async function resizeImageForAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a PNG, JPG, or WebP image.')
  }

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process image.')

  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const qualities = [0.85, 0.7, 0.55, 0.4]
  for (const quality of qualities) {
    const webp = canvas.toDataURL('image/webp', quality)
    if (webp.startsWith('data:image/webp') && webp.length <= MAX_DATA_URL_CHARS) return webp
  }
  for (const quality of qualities) {
    const jpeg = canvas.toDataURL('image/jpeg', quality)
    if (jpeg.length <= MAX_DATA_URL_CHARS) return jpeg
  }

  throw new Error('Image is too large. Try a smaller file (under 200KB).')
}
