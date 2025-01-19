import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'

import * as sourceVideosSchema from './schema/sourceVideos'
import * as videoFramesSchema from './schema/videoFrames'
import * as videoFrameLabelsSchema from './schema/videoFrameLabels'

const client = new PGlite('idb://data-stamper-db')
const db = drizzle(client, {
  casing: 'snake_case',
  schema: { ...sourceVideosSchema, ...videoFramesSchema, ...videoFrameLabelsSchema },
})

export default db
