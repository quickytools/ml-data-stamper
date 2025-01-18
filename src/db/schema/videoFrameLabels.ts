import { pgTable, integer, text, json } from 'drizzle-orm/pg-core'

import { videoFrames } from './videoFrames'

export const videoFrameLabels = pgTable('video_frame_labels', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  videoFrameId: integer('video_frame_id').references(() => videoFrames.id),
  labelType: text('label_type', { enum: ['rectangle', 'circle', 'closed_curve'] })
    .notNull()
    .default('rectangle'),
  labelData: json('label_data').notNull(),
})
