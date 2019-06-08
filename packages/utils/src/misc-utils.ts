import { Dictionary } from './types'

export function buildProps<TArg, TProps extends Dictionary = Dictionary>(
  app: TArg,
  props?: TProps | ((arg: TArg) => TProps),
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
