import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'

const client = new PGlite()
const db = drizzle(client, { casing: 'snake_case' })

export default db
