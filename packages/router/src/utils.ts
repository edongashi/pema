import {
  View,
  Delayed,
  DelayableAction,
  AnyAction,
  Path,
  Location,
  ActionParams
} from './types'
import { invariant } from '@pema/app'
import { Location as HistoryLocation } from 'history'
import { JValue } from '@pema/app/lib/types'
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

export function locationsEqual(l1: HistoryLocation, l2: HistoryLocation) {
  return l1.pathname === l2.pathname && l1.search === l2.search && l1.hash === l2.hash
}

export function toHistoryLocation(path: Path, currentLocation: HistoryLocation): HistoryLocation {
  throw new Error()
}

export function fromHistoryLocation(location: HistoryLocation): Location {
  throw new Error()
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
