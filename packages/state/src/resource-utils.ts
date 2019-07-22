export function normalizeResource(path: string) {
  const parts = path.split('/', 2)
  if (parts.length < 2) {
    parts.push('*')
  }

  return parts
}

export function matchResource(pattern: string, resource: string): boolean {
  if (pattern === '*' || pattern === resource) {
    return true
  }

  const [type1, id1] = normalizeResource(pattern)
  const [type2, id2] = normalizeResource(resource)
  if (type1 !== type2) {
    return false
  }

  return id1 === '*' || id1 === id2
}
