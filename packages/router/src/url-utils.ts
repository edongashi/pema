import { Path, Location } from './types'
import { warning, JObject } from '@pema/utils'
import { Location as HistoryLocation } from 'history'
import { parsePath } from 'history/PathUtils'
import { createLocation } from 'history/LocationUtils'
import qs from 'qs'

export function isOnlyHashChange(oldHref: string, newHref: string): boolean {
  const [oldUrl, oldHash] = oldHref.split('#')
  const [newUrl, newHash] = newHref.split('#')
  if (newHash && oldUrl === newUrl && oldHash === newHash) {
    return true
  }

  if (oldUrl !== newUrl) {
    return false
  }

  return oldHash !== newHash
}

export function locationsEqual(l1: HistoryLocation, l2: HistoryLocation): boolean {
  return l1.pathname === l2.pathname && l1.search === l2.search && l1.hash === l2.hash
}

function mergeSearch(a: JObject | string, b: string): JObject {
  if (typeof a === 'string') {
    a = qs.parse(a) as JObject
  }

  return { ...qs.parse(b || ''), ...a }
}

function combine(path: string, query?: JObject, hash?: string): HistoryLocation {
  const { pathname, search: searchStr, hash: hashStr } = parsePath(path)
  if (query && searchStr) {
    query = mergeSearch(query, searchStr)
  }

  warning(
    !(hash && hashStr),
    'A hash string is found in path. This will be overwritten because \'hash\' parameter exists in location.')
  return {
    pathname,
    search: qs.stringify(query),
    hash: hash || hashStr,
    state: undefined
  }
}

export function toHistoryLocation(path: Path, currentLocation: HistoryLocation): HistoryLocation {
  if (typeof path === 'string') {
    return createLocation(path, undefined, undefined, currentLocation)
  } else if (Array.isArray(path)) {
    return createLocation(
      combine(path[0] || '', path[1], path[2]),
      null,
      undefined,
      currentLocation)
  } else if (path !== null && typeof path === 'object') {
    return createLocation(
      combine(path.path || (path as any).pathname || '', path.query, path.hash),
      null,
      undefined,
      currentLocation)
  } else {
    throw new Error('Invalid location.')
  }
}

export function fromHistoryLocation(location: HistoryLocation): Location {
  const query = qs.parse(location.search || '', { ignoreQueryPrefix: true })
  return {
    path: location.pathname,
    hash: location.hash,
    query
  }
}

export function join(path1: string, path2: string): string {
  if (path2[0] === '/') {
    path2 = path2.substr(1)
  }

  if (path1[path1.length - 1] === '/') {
    return path1 + path2
  } else {
    return path1 + '/' + path2
  }
}
