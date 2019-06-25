import toJson from 'serialize-error'
import { ErrorLike, ErrorObject } from './types'

const unknownError = 'Error'

export function serializeError(error: ErrorLike): ErrorObject | null {
  if (!error) {
    return null
  }

  if (typeof error === 'string') {
    return { message: error }
  }

  return toJson(error)
}

export function stringifyError(error: ErrorLike): string {
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
