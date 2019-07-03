import {
  AllowResult,
  ControllerConstructor,
  ControllerResult,
  Delayed,
  DelayedResult,
  DenyResult,
  Path,
  RedirectResult,
  ViewResult,
  LazyResult,
  LazyResolver,
  ErrorResult,
  View,
  FallbackView,
  RouteConfig,
  RoutingTable,
  DelayableAction,
  AnyAction,
  ActionParams,
  ControllerAction
} from './types'
import { mapLazy, memoizeLazy, serializeError, ErrorLike } from '@pema/utils'

export function delay
  <T, TParams extends ActionParams = ActionParams>
  (p: Delayed<T, TParams>, fallback?: FallbackView): DelayedResult<T, TParams> {
  return {
    __result: true,
    type: 'delay',
    value: p,
    fallback
  }
}

export function lazy
  <T, TParams extends ActionParams = ActionParams>
  (resolver: LazyResolver<T, TParams>, fallback?: FallbackView): LazyResult<T, TParams> {
  return {
    __result: true,
    type: 'lazy',
    value: memoizeLazy(resolver),
    fallback
  }
}

export function lazyView<TView extends View>
  (resolver: (() => Promise<TView>), fallback?: FallbackView) {
  return lazy(mapLazy(resolver, view), fallback)
}

export function lazyController<TController extends ControllerConstructor>
  (resolver: (() => Promise<TController>), fallback?: FallbackView) {
  return lazy(mapLazy(resolver, controller), fallback)
}

lazy.view = lazyView
lazy.controller = lazyController

export function view(view: View): ViewResult {
  return {
    __result: true,
    type: 'view',
    view
  }
}

view.lazy = lazyView

export function error(code: number, error?: ErrorLike): ErrorResult {
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

export function controller<T extends ControllerConstructor>
  (ctor: T, defaultAction?: ControllerAction): ControllerResult {
  return {
    __result: true,
    type: 'controller',
    controller: ctor,
    defaultAction
  }
}

controller.lazy = lazyController

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

export function route
  <TParams extends ActionParams = ActionParams>
  (action: DelayableAction<AnyAction, TParams>, routes?: RoutingTable): RouteConfig
export function route
  <TParams extends ActionParams = ActionParams>
  (actions: DelayableAction<AnyAction>[], routes?: RoutingTable): RouteConfig
export function route
  <TParams extends ActionParams = ActionParams>
  (config: RouteConfig): RouteConfig
export function route
  <TParams extends ActionParams = ActionParams>
  (config: RouteConfig & { routes?: never }, routes: RoutingTable): RouteConfig
export function route
  (config: DelayableAction<AnyAction> | DelayableAction<AnyAction>[] | RouteConfig, routes?: RoutingTable) {
  if (typeof config === 'function') {
    return {
      onEnter: delay(config),
      routes
    }
  }

  if (Array.isArray(config) || config.__result) {
    return {
      onEnter: config,
      routes
    }
  }

  if (routes) {
    return { ...config, routes }
  } else {
    return config
  }
}
