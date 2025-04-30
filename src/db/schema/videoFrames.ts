import { pgTable, integer, index } from 'drizzle-orm/pg-core'

import { sourceVideos } from './sourceVideos'

export const videoFrames = pgTable(
  'video_frames',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    videoId: integer('video_id').references(() => sourceVideos.id),
    frameIndex: integer('frame_index').notNull(),
  },
  (table) => [index('video_frame_idx').on(table.videoId, table.frameIndex)],
)
