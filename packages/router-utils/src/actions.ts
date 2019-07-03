import { controller, ControllerConstructor, FallbackView, lazy, view, View } from '@pema/router'
import { mapLazy } from '@pema/utils'

export function lazyView<TView extends View>
  (resolver: (() => Promise<TView>), fallback?: FallbackView) {
  return lazy(mapLazy(resolver, view), fallback)
}

export function lazyController<TController extends ControllerConstructor>
  (resolver: (() => Promise<TController>), fallback?: FallbackView) {
  return lazy(mapLazy(resolver, controller), fallback)
}
