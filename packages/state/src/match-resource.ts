export function matchResource(pattern: string, resource: string): boolean {
  if (pattern === '*' || pattern === resource) {
    return true
  }

  if (resource === '*') {
    return false
  }

  const patternParts = pattern.split('/')
  let len = patternParts.length
  const exact = patternParts[len - 1] === ''
  if (exact) {
    len--
  }

  const resourceParts = resource.split('/')
  for (let i = 0; i < len; i++) {
    if (patternParts[i] === '*') {
      continue
    }

    if (patternParts[i] !== resourceParts[i]) {
      return false
    }
  }

  return !exact || len === resourceParts.length
}
