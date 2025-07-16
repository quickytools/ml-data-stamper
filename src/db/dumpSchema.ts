import type { PGlite } from '@electric-sql/pglite'

const sectionBar = '====================='
const sectionHeader = (sectionName: string) => {
  return [sectionBar, sectionName, `${sectionBar}\n\n`].map((s) => `-- ${s}`).join('\n')
}

export async function schemaDump(db: PGlite) {
  console.log('db', db.fs.dataDir, db)
  let schemaDump = ''

  try {
    schemaDump += '-- PGlite Database Schema Dump\n'
    schemaDump += `-- Generated: ${new Date().toISOString()}\n\n`

    schemaDump += sectionHeader('TABLES')

    const tables = await db.query(`
      SELECT 
        schemaname,
        tablename,
        tableowner
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `)

    for (const table of tables.rows) {
      const tableName = table.tablename

      const columns = await db.query(
        `
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          numeric_precision,
          numeric_scale,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_name = $1 AND table_schema = 'public'
        ORDER BY ordinal_position
      `,
        [tableName],
      )

      schemaDump += `CREATE TABLE ${tableName} (\n`

      const columnDefs = columns.rows.map((col) => {
        let def = `  ${col.column_name} `

        switch (col.data_type) {
          case 'character varying':
            def += `VARCHAR(${col.character_maximum_length || 255})`
            break
          case 'character':
            def += `CHAR(${col.character_maximum_length})`
            break
          case 'numeric':
            def += `NUMERIC(${col.numeric_precision},${col.numeric_scale})`
            break
          default:
            def += col.data_type.toUpperCase()
        }

        if (col.is_nullable === 'NO') {
          def += ' NOT NULL'
        }

        if (col.column_default) {
          def += ` DEFAULT ${col.column_default}`
        }

        return def
      })

      schemaDump += columnDefs.join(',\n')
      schemaDump += '\n);\n\n'
    }

    schemaDump += sectionHeader('INDEXES')
    const indexes = await db.query(`
      SELECT indexdef || ';' as index_statement
      FROM pg_indexes
      WHERE schemaname = 'public' AND indexname NOT LIKE '%_pkey'
      ORDER BY indexname
    `)

    for (const index of indexes.rows) {
      schemaDump += index.index_statement + '\n'
    }
    schemaDump += '\n'

    const sequences = await db.query(`
      SELECT 
        sequencename,
        start_value,
        min_value,
        max_value,
        increment_by,
        cycle
      FROM pg_sequences
      WHERE schemaname = 'public'
      ORDER BY sequencename
    `)
    if (sequences.rows.length) {
      schemaDump += sectionHeader('SEQUENCES')

      for (const seq of sequences.rows) {
        schemaDump += `CREATE SEQUENCE ${seq.sequencename}\n`
        schemaDump += `  START WITH ${seq.start_value}\n`
        schemaDump += `  INCREMENT BY ${seq.increment_by}\n`
        schemaDump += `  MINVALUE ${seq.min_value}\n`
        schemaDump += `  MAXVALUE ${seq.max_value}\n`
        schemaDump += `  ${seq.cycle ? 'CYCLE' : 'NO CYCLE'};\n\n`
      }
    }

    const functions = await db.query(`
      SELECT 
        p.proname as function_name,
        pg_get_functiondef(p.oid) as function_definition
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.prokind = 'f'
      ORDER BY p.proname
    `)
    if (functions.rows.length) {
      schemaDump += sectionHeader('FUNCTIONS')

      for (const func of functions.rows) {
        schemaDump += `-- Function: ${func.function_name}\n`
        schemaDump += func.function_definition + '\n\n'
      }
    }

    const triggerFunctions = await db.query(`
      SELECT 
        p.proname as function_name,
        pg_get_functiondef(p.oid) as function_definition
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.prokind = 'f'
        AND p.prorettype = 'trigger'::regtype
      ORDER BY p.proname
    `)
    if (triggerFunctions.rows.length) {
      schemaDump += sectionHeader('TRIGGERS')

      for (const func of triggerFunctions.rows) {
        schemaDump += `-- Trigger Function: ${func.function_name}\n`
        schemaDump += func.function_definition + '\n\n'
      }

      const triggers = await db.query(`
      SELECT 
      t.tgname as trigger_name,
      c.relname as table_name,
      pg_get_triggerdef(t.oid) as trigger_definition
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'public'
      AND NOT t.tgisinternal
      ORDER BY c.relname, t.tgname
      `)

      for (const trigger of triggers.rows) {
        schemaDump += `-- Trigger: ${trigger.trigger_name} on ${trigger.table_name}\n`
        schemaDump += trigger.trigger_definition + ';\n\n'
      }
    }

    const views = await db.query(`
      SELECT 
        viewname,
        definition
      FROM pg_views
      WHERE schemaname = 'public'
      ORDER BY viewname
    `)
    if (views.rows.length) {
      schemaDump += sectionHeader('VIEWS')

      for (const view of views.rows) {
        schemaDump += `CREATE VIEW ${view.viewname} AS\n`
        schemaDump += view.definition + '\n\n'
      }
    }

    schemaDump += sectionHeader('CONSTRAINTS')
    const constraints = await db.query(`
      SELECT 
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        pg_get_constraintdef(pgc.oid) as constraint_definition
      FROM information_schema.table_constraints tc
      JOIN pg_constraint pgc ON tc.constraint_name = pgc.conname
      WHERE tc.table_schema = 'public'
        AND tc.constraint_type IN ('FOREIGN KEY', 'CHECK', 'UNIQUE')
      ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name
    `)
    for (const constraint of constraints.rows) {
      schemaDump += `-- ${constraint.constraint_type} constraint on ${constraint.table_name}\n`
      schemaDump += `ALTER TABLE ${constraint.table_name} ADD CONSTRAINT ${constraint.constraint_name} ${constraint.constraint_definition};\n\n`
    }

    schemaDump += '-- End of schema dump\n'

    return schemaDump
  } catch (error) {
    console.error('Error dumping schema:', error)
    schemaDump += `-- ERROR: ${error.message}\n`
    return schemaDump
  }
}

export async function exportDbFile(db: PGlite) {
  const saveFileName = `${db.fs.dataDir}.sql`
  try {
    const dumpResult = await db.dumpDataDir()

    const blob = new Blob([dumpResult], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = saveFileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    return blob
  } catch (error) {
    console.error(`${saveFileName} database error:`, error)
    throw error
  }
}
