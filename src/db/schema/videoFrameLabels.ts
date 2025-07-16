import { pgTable, integer, text, json, timestamp, index } from 'drizzle-orm/pg-core'
import { videoFrames } from './videoFrames'

export const videoFrameLabels = pgTable(
  'video_frame_labels',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    videoFrameId: integer('video_frame_id')
      .references(() => videoFrames.id, { onDelete: 'cascade' })
      .notNull(),
    labelType: text('label_type', { enum: ['rectangle', 'circle', 'closed_curve'] })
      .notNull()
      .default('rectangle'),
    labelData: json('label_data').notNull(),
    modifiedAt: timestamp('modified_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    // TODO autoDetectedLabelData
    // TODO autoDetectionModel
    // TODO selectionPose (center and zoom)
  },
  (table) => [
    index('idx_video_frame_label_video_frame').on(table.videoFrameId),
    index('idx_video_frame_labels_deleted_at').on(table.deletedAt),
  ],
)
