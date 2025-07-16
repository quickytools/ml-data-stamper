<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { schemaDump, exportDbFile } from '@/db/dumpSchema'
import db from '@/db/drizzleDb'

import { PGlite } from 'https://cdn.jsdelivr.net/npm/@electric-sql/pglite/dist/index.js'

const loadScriptIfNotExists = async (src) => {
  if (document.querySelector(`script[src="${src}"]`)) {
    return
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.type = 'module'
    script.onload = () => {
      resolve()
    }

    script.onerror = () => {
      console.error('Failed to load script:', src)
      reject(new Error(`Failed to load script: ${src}`))
    }

    document.head.appendChild(script)
  })
}

onMounted(async () => {
  await loadScriptIfNotExists(
    'https://cdn.jsdelivr.net/npm/@electric-sql/pglite-repl/dist-webcomponent/Repl.js',
  )

  const pg = db.$client
  const repl = document.getElementById('repl')
  repl.pg = pg

  const schema = await schemaDump(pg)
  console.log('schema', schema)
})
</script>

<template lang="pug">
div.fullscreen
    pglite-repl#repl
</template>
