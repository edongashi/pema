import {
  View,
  Delayed,
  DelayableAction,
  AnyAction,
  Path,
  Location,
  ActionParams
} from '../types'
import { invariant, warning, JValue, JObject } from '@pema/app'
import { Location as HistoryLocation } from 'history'
import { parsePath } from 'history/PathUtils'
import { createLocation } from 'history/LocationUtils'
import { encode as b32encode, decode as b32decode } from 'hi-base32'
import qs from 'qs'

export function hash(str: string): number {
  let hash = 5381
  let i = str.length

  while (i) {
    hash = (hash * 33) ^ str.charCodeAt(--i)
  }

  return hash >>> 0
}

export function encode(data: JValue): string {
  const json = JSON.stringify(data)
  const h = hash(json).toString(36)
  let d = ''
  let j = h.length
  for (let i = 0; i < json.length; i++) {
    d += String.fromCharCode(
      json.charCodeAt(i) ^ h.charCodeAt(--j)
    )

    if (j < 0) {
      j = h.length
    }
  }

  let b32 = b32encode(d + '/' + h)
  const eqIndex = b32.indexOf('=')
  if (eqIndex > 0) {
    b32 = b32.substr(0, eqIndex)
  }

  return b32.toLowerCase()
}

const decodeError = 'Invalid string.'

export function decode(str: string): JValue {
  const data = b32decode(str.toUpperCase())
  const pos = data.lastIndexOf('/')
  if (pos < 0) {
    throw new Error(decodeError)
  }

  const d = data.substr(0, pos)
  const h = data.substr(pos + 1)
  let json = ''
  let j = h.length
  for (let i = 0; i < d.length; i++) {
    json += String.fromCharCode(
      d.charCodeAt(i) ^ h.charCodeAt(--j)
    )

    if (j < 0) {
      j = h.length
    }
  }

  const computedHash = hash(json).toString(36)
  if (h !== computedHash) {
    throw new Error(decodeError)
  }

  return JSON.parse(json)
}

export function tryDecode(str: string): {
  state: JValue,
  validState: boolean
} {
  if (typeof str === 'string' && str.length > 0) {
    try {
      return { state: decode(str), validState: true }
    } catch (err) {
      return { state: null, validState: false }
    }
  } else {
    return { state: null, validState: true }
  }
}

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

function mergeState(query: JObject | string, state?: JValue): string {
  if (state !== undefined && state !== null) {
    state = encode(state)
    if (!query) {
      return qs.stringify({ view_state: state })
    }

    if (typeof query === 'string') {
      query = qs.parse(query, { ignoreQueryPrefix: true }) as JObject
    } else if (typeof query !== 'object') {
      warning(false, 'Invalid query object.')
      return qs.stringify({ view_state: state })
    }

    warning(
      !('view_state' in query),
      'Query object should not contain key \'view_state\' because it will be overwritten by state.')
    return qs.stringify({ ...query, view_state: state })
  } else if (query !== null && typeof query === 'object') {
    return qs.stringify(query)
  } else if (typeof query === 'string') {
    return query
  } else {
    return ''
  }
}

function mergeSearch(a: JObject | string, b: string): JObject {
  if (typeof a === 'string') {
    a = qs.parse(a) as JObject
  }

  return { ...qs.parse(b || ''), ...a }
}

function combine(path: string, query?: JObject, state?: JValue, hash?: string): HistoryLocation {
  const { pathname, search: searchStr, hash: hashStr } = parsePath(path)
  if (query && searchStr) {
    query = mergeSearch(query, searchStr)
  }

  warning(
    !(hash && hashStr),
    'A hash string is found in path. This will be overwritten because \'hash\' parameter exists in location.')
  return {
    pathname,
    search: mergeState(query || searchStr, state),
    hash: hash || hashStr,
    state: undefined
  }
}

export function toHistoryLocation(path: Path, currentLocation: HistoryLocation): HistoryLocation {
  if (typeof path === 'string') {
    return createLocation(path, undefined, undefined, currentLocation)
  } else if (Array.isArray(path)) {
    return createLocation(
      combine(path[0] || '', path[1], path[2], path[3]),
      null,
      undefined,
      currentLocation)
  } else if (path !== null && typeof path === 'object') {
    return createLocation(
      combine(path.path || (path as any).pathname || '', path.query, path.state, path.hash),
      null,
      undefined,
      currentLocation)
  } else {
    throw new Error('Invalid location.')
  }
}

export function fromHistoryLocation(location: HistoryLocation): Location {
  const { view_state, ...query } = qs.parse(location.search || '', { ignoreQueryPrefix: true })
  const { state, validState } = tryDecode(view_state)
  return {
    path: location.pathname,
    hash: location.hash,
    query,
    state,
    validState
  }
}

export function noop() { }

export async function resolveActions(arg: ActionParams, actions: DelayableAction<AnyAction> | DelayableAction<AnyAction>[], setFallbackView: (view: View) => void): Promise<AnyAction> {
  if (!Array.isArray(actions)) {
    actions = [actions]
  }

  async function resolveDelayed<T>(value: Delayed<T>, fallback: View | undefined): Promise<T> {
    const v = value as any
    if (!v) {
      return v
    }

    if (typeof v.then === 'function') {
      if (typeof fallback !== 'undefined') {
        setFallbackView(fallback)
      }

      return await v
    }

    const promise = v(arg)
    if (promise && typeof promise.then === 'function') {
      if (typeof fallback !== 'undefined') {
        setFallbackView(fallback)
      }

      return await promise
    } else {
      return promise
    }
  }

  for (let i = 0; i < actions.length; i++) {
    let action = actions[i]
    if (action.type === 'lazy') {
      if (typeof action.fallback !== 'undefined') {
        setFallbackView(action.fallback)
      }

      try {
        action = await action.value()
      } catch (e) {
        return { type: 'error', error: e }
      }
    }

    let resolvedAction: AnyAction
    if (action.type === 'delay') {
      try {
        resolvedAction = await resolveDelayed(action.value, action.fallback)
      } catch (e) {
        return { type: 'error', error: e }
      }
    } else {
      invariant((action as any).type !== 'lazy', 'Cannot resolve a delayed lazy result.')
      resolvedAction = action
    }

    if (resolvedAction && resolvedAction.type !== 'allow') {
      return resolvedAction
    }
  }

  return { type: 'allow' }
}

export function toArray<T>(arg?: T | T[]): T[] {
  if (Array.isArray(arg)) {
    return arg
  } else if (typeof arg !== 'undefined') {
    return [arg]
  } else {
    return []
  }
}
