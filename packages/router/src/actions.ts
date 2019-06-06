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
import { ErrorObject, serializeError } from '@pema/utils'

export function delay<T>
  (p: Delayed<T>, fallback?: View): DelayedResult<T> {
  return {
    __result: true,
    type: 'delay',
    value: p,
    fallback
  }
}

export function lazy<T>(fn: LazyResolver<T>, fallback?: View): LazyResult<T> {
  return {
    __result: true,
    type: 'lazy',
    value: fn,
    fallback
  }
}

export function view(view: View): ViewResult {
  return {
    __result: true,
    type: 'view',
    view
  }
}

export function error(code: number, error?: ErrorObject | string): ErrorResult {
  return {
    __result: true,
    type: 'error',
    code,
    error: error ? serializeError(error) : null
  }
}

export function redirect(path: Path): RedirectResult {
  return {
    __result: true,
    type: 'redirect',
    path
  }
}

export function controller<T extends ControllerConstructor>(ctor: T): ControllerResult {
  return {
    __result: true,
    type: 'controller',
    controller: ctor
  }
}

export function allow(): AllowResult {
  return {
    __result: true,
    type: 'allow'
  }
}

export function deny(): DenyResult {
  return {
    __result: true,
    type: 'deny'
  }
}
