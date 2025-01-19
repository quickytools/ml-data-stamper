import type { VideoDescription } from '@/db/dao'
import * as sourceVideoDao from '@/db/dao/sourceVideoDao'

export const saveVideo = async (description: VideoDescription) => {
  return sourceVideoDao.insertVideo(description)
}

export const getVideo = async (fileSignature: string) => {
  return sourceVideoDao.queryVideo(fileSignature)
}
