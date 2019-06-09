import { JValue } from '@pema/utils'
import { encode as b32encode, decode as b32decode } from 'hi-base32'

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
