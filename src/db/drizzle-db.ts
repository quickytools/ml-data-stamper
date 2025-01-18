import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'

const client = new PGlite('idb://data-stamper-db')
const db = drizzle(client, { casing: 'snake_case' })

export default db
