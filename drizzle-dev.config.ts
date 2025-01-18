import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema',
  out: './drizzle/dev',

  driver: 'pglite',

  migrations: {
    prefix: 'timestamp',
    table: '__drizzle_migrations__',
    schema: 'public',
  },

  strict: true,
  verbose: true,
  breakpoints: false,
})
