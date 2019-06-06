import {
  AllowResult,
  ControllerConstructor,
  ControllerResult,
  Delayed,
  DelayedResult,
  DenyResult,
  Path,
  RedirectResult,
  View,
  ViewResult,
  LazyResult,
  LazyResolver,
  ErrorResult
} from './types'
import { JValue, ErrorObject, serializeError } from '@pema/utils'

export function delay<T>
  (p: Delayed<T>, fallback?: View): DelayedResult<T> {
  return {
    type: 'delay',
    value: p,
    fallback
  }
}

export function lazy<T>(fn: LazyResolver<T>, fallback?: View): LazyResult<T> {
  return {
    type: 'lazy',
    value: fn,
    fallback
  }
}

export function view(view: View): ViewResult {
  return {
    type: 'view',
    view
  }
}

export function error(code: number, error?: ErrorObject | string): ErrorResult {
  return {
    type: 'error',
    code,
    error: error ? serializeError(error) : null
  }
}

export function redirect(path: Path): RedirectResult {
  return {
    type: 'redirect',
    path
  }
}

export function controller<T extends ControllerConstructor>(ctor: T): ControllerResult {
  return {
    type: 'controller',
    controller: ctor
  }
}

export function allow(): AllowResult {
  return { type: 'allow' }
}

export function deny(): DenyResult {
  return { type: 'deny' }
}
