import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
})

export { cloudinary }

export async function uploadCardPhoto(
  file: Buffer,
  options: {
    listingId: string
    side: 'front' | 'back'
    tcg: 'pokemon' | 'onepiece'
  }
): Promise<string> {
  const folder = `Goriki/${options.tcg}/${options.side}`
  const publicId = `${options.listingId}_${options.side}`

  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        overwrite: true,
        transformation: [
          { width: 600, height: 840, crop: 'limit', quality: 'auto:good' },
        ],
      },
      (error, result) => {
        if (error || !result) reject(error ?? new Error('Upload failed'))
        else resolve(result.secure_url)
      }
    ).end(file)
  })
}
