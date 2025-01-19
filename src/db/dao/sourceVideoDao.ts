import { eq } from 'drizzle-orm'
import db from '../drizzleDb'
import type { VideoDescription } from '.'
import { sourceVideos } from '../schema/sourceVideos'
import Joi from 'joi'

const videoDescriptionSchema = Joi.object({
  fileName: Joi.string().min(3).required(),
  sizeBytes: Joi.number().greater(0).required(),
  signature: Joi.string()
    .pattern(/^[a-f0-9]{64}$/i)
    .required(),
  frameCount: Joi.number().integer().min(1).required(),
  frameRate: Joi.number().greater(0).required(),
  orientationDegrees: Joi.number().min(0).max(270).multiple(90),
})

export const insertVideo = async (description: VideoDescription) => {
  const validated = Joi.attempt(description, videoDescriptionSchema)
  const inserted = await db
    .insert(sourceVideos)
    .values(validated)
    .returning({ insertedId: sourceVideos.id })
  return inserted.length ? inserted[0].insertedId : -1
}

export const queryVideo = async (signature: string) => {
  const videos = await db.query.sourceVideos.findMany({
    where: eq(sourceVideos.signature, signature),
  })
  return videos.length ? videos[0] : null
}
