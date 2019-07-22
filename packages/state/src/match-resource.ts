export function matchResource(pattern: string, resource: string): boolean {
  if (pattern === '*' || pattern === resource) {
    return true
  }

  const patternParts = pattern.split('/')
  const resourceParts = resource.split('/')
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i] === '*') {
      continue
    }

    if (patternParts[i] !== resourceParts[i]) {
      return false
    }
  }

  return true
}
