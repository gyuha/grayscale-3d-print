export interface DecodedImage {
  rgba: Uint8ClampedArray
  w: number
  h: number
  url: string
  name: string
}

/** Decode an uploaded image file into RGBA pixels via a canvas. */
export async function decodeFile(file: File): Promise<DecodedImage> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
  bitmap.close()
  return { rgba: data, w: canvas.width, h: canvas.height, url: URL.createObjectURL(file), name: file.name.replace(/\.[^.]+$/, '') }
}
