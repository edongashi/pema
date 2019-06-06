import toJson from 'serialize-error'
import { ErrorObject, JValue } from './types'

const unknownError = 'Error'

export function serializeError(error: ErrorObject | string): JValue {
  if (!error) {
    return null
  }

  if (typeof error === 'string') {
    return { message: error }
  }

  return toJson(error)
}

export function stringifyError(error: ErrorObject | string): string {
  if (!error) {
    return unknownError
  }

  const result = toJson(error)
  if (typeof result === 'object') {
    return result.message || unknownError
  } else if (result) {
    return result.toString() || unknownError
  } else {
    return unknownError
  }
}
