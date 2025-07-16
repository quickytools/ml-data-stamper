import { sql } from 'drizzle-orm'
import { pgTable, text, integer, bigint, real, check, index } from 'drizzle-orm/pg-core'

export const sourceVideos = pgTable(
  'source_videos',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    signature: text().notNull().unique(),
    frameCount: integer('frame_count').notNull(),
    frameRate: real('frame_rate').notNull(),
    orientationDegrees: integer('orientation_degrees').notNull().default(0),
    fileName: text('file_name').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'bigint' }).notNull(),
  },
  (table) => [
    check('orientation_degrees_validity', sql`${table.orientationDegrees} IN (0, 90, 180, 270)`),
  ],
)
