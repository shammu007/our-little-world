/** Reads an image file, downsizes it for the web (max 2048px), and returns a JPEG/WebP blob plus its aspect ratio. */
export async function prepareImage(file: File, maxSize = 2048): Promise<{ blob: Blob; aspect: number; width: number; height: number }> {
  if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type)) throw new Error('Please choose a JPEG, PNG or WebP image.')
  if (file.size > 30 * 1024 * 1024) throw new Error('That image is larger than 30 MB.')
  const bitmap = await loadBitmap(file)
  const { width: w0, height: h0 } = bitmap
  const scale = Math.min(1, maxSize / Math.max(w0, h0))
  const width = Math.round(w0 * scale)
  const height = Math.round(h0 * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, width, height)
  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close()
  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('Could not encode the image.'))), 'image/jpeg', 0.88),
  )
  return { blob, aspect: width / height, width, height }
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
    } catch {
      /* fall through */
    }
  }
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = () => rej(new Error('Could not read that image.'))
    img.src = URL.createObjectURL(file)
  })
}
