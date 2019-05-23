import { AppNode, Dictionary } from "./types";

export function getProps(
  app: AppNode,
  props?: Function | Dictionary,
  clone = true): Dictionary {
  if (props && typeof props === 'object') {
    return clone ? { ...props } : props
  }

  if (typeof props === 'function') {
    return props(app) || {}
  }

  return {}
}

const isProduction: boolean = process.env.NODE_ENV === 'production';

export function warning(condition: any, message: string) {
  if (!isProduction) {
    if (condition) {
      return
    }

    const text: string = `Warning: ${message}`
    if (typeof console !== 'undefined') {
      console.warn(text)
    }

    try {
      throw Error(text)
    } catch (x) { }
  }
}

export function invariant(condition: any, message?: string) {
  if (condition) {
    return
  }

  if (isProduction) {
    throw new Error('Invariant failed')
  } else {
    throw new Error(`Invariant failed: ${message || ''}`)
  }
}
