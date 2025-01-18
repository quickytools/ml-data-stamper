export async function getFileSignature(file: File) {
  const blob = new Blob([file])
  const buffer = await blob.arrayBuffer()
  const messsage = new Uint8Array(buffer)
  const hashBuffer = await crypto.subtle.digest('SHA-256', messsage)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}
