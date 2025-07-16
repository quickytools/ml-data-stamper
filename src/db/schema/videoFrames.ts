import { pgTable, integer, index, unique } from 'drizzle-orm/pg-core'

import { sourceVideos } from './sourceVideos'

export const videoFrames = pgTable(
  'video_frames',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    videoId: integer('video_id')
      .references(() => sourceVideos.id, { onDelete: 'cascade' })
      .notNull(),
    frameIndex: integer('frame_index').notNull(),
  },
  (table) => [unique('unq_video_frame').on(table.videoId, table.frameIndex)],
)
