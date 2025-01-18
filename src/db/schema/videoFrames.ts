import { pgTable, integer } from 'drizzle-orm/pg-core'

import { sourceVideos } from './sourceVideos'

export const videoFrames = pgTable('video_frames', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  videoId: integer('video_id').references(() => sourceVideos.id),
  frameIndex: integer('frame_index').notNull(),
})
