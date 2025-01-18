import db from '../drizzle-db'
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
  return db.insert(sourceVideos).values(validated)
}
