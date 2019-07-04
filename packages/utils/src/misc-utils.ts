import { Dictionary, Options } from './types'

export function buildOptions<TArg, TProps extends Dictionary = Dictionary>(
  app: TArg,
  props?: Options<TProps, TArg>,
  clone = true): TProps | Dictionary {
  if (props && typeof props === 'object') {
    return clone ? { ...props } : props
  }

  if (typeof props === 'function') {
    return props(app) || {}
  }

  return {}
}

export function noop() { }

export function toArray<T>(arg?: T | T[]): T[] {
  if (Array.isArray(arg)) {
    return arg
  } else if (typeof arg !== 'undefined') {
    return [arg]
  } else {
    return []
  }
}

export function mapLazy<T, U>
  (resolver: (() => Promise<T>), fn: (t: T) => U): () => Promise<U> {
  return function () {
    return resolver().then(fn)
  }
}

export function memoizeLazy<T>(resolver: () => Promise<T>): () => Promise<T> {
  let promise: null | Promise<T> = null
  return () => {
    if (promise) {
      return promise
    } else {
      const temp = resolver()
        .then(result => {
          (promise as any).resolved = true
          return result
        }, err => {
          promise = null
          throw err
        })

      promise = temp
      return temp
    }
  }
}
