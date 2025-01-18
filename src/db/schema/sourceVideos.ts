import { sql } from 'drizzle-orm'
import { pgTable, text, integer, real, check } from 'drizzle-orm/pg-core'
export const sourceVideos = pgTable(
  'source_videos',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    signature: text().notNull().unique(),
    frameCount: integer('frame_count').notNull(),
    frameRate: real('frame_rate').notNull(),
    orientationDegrees: integer('orientation_degrees').notNull().default(0),
  },
  (table) => [
    {
      checkConstraint: check(
        'orientation_degrees_validity',
        sql`${table.orientationDegrees} IN (0, 90, 180, 270)`,
      ),
    },
  ],
)
