const { readMigrationFiles } = require('drizzle-orm/migrator')
const fs = require('fs')

const migrations = readMigrationFiles({ migrationsFolder: './drizzle' })

fs.writeFileSync('./src/db/migrations.json', JSON.stringify(migrations))

console.log('Migrations compiled!')
