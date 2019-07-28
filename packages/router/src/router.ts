import {
  Router,
  RouterState,
  Path,
  Controller,
  RouterView,
  AnyAction,
  RouterEnv,
  DelayableAction,
  ControllerAction,
  ActionParams,
  ControllerConstructor,
  RoutingTable,
  FallbackView,
  View
} from './types'
import {
  toArray,
  noop,
  buildOptions,
  warning,
  JObject,
  Dictionary,
  JValue
} from '@pema/utils'
import { AppNode } from '@pema/app'
import {
  History,
  Location as HistoryLocation,
  Action as HistoryAction
} from 'history'
import throttle from 'lodash.throttle'
import {
  toHistoryLocation,
  fromHistoryLocation,
  locationsEqual,
  isOnlyHashChange
} from './url-utils'
import RouteCollection from './route-collection'
import { error, allow } from './actions'
import resolveActions from './resolve-actions'
import { matchPath } from './match'

interface ViewSetter {
  (fallback: FallbackView): void
  cancel(): void
}

interface CachedParams {
  location: HistoryLocation
  action: 'PUSH' | 'REPLACE' | 'POP'
  params: ActionParams
  state: RouterState,
  hashChangeOnly: boolean
}

interface SessionType {
  [key: string]: JObject
}

const notFound = error(404)
const forbidden = error(403)

function dataSaving() {
  if (process.env.NODE_ENV !== 'production') {
    return false
  }

  const connection = (navigator && (navigator as Dictionary).connection) as Dictionary
  if (connection) {
    return connection.saveData || (connection.effectiveType || '').indexOf('2g') !== -1
  } else {
    return false
  }
}

export default class RouterImpl implements Router {
  private readonly app: AppNode
  private readonly routes: RouteCollection
  private readonly controllersPath: string
  private readonly history: History
  private readonly unblock: () => void
  private readonly unlisten: () => void
  private readonly fallbackSetter: ViewSetter
  private readonly fallbackComputed: boolean

  private readonly session: SessionType
  private locked: boolean = false
  private cachedParams: CachedParams | null = null

  private get currentController(): Controller | null {
    return this.current && this.current.controller || null
  }

  private __setView(routerView: RouterView): void {
    const previousView = this.view
    this.view = routerView
    this.app.emit('router.view', routerView, previousView)
  }

  private emitCurrent(previous: RouterState): void {
    this.app.emit('router.current', this.current, previous)
  }

  private terminate(result: AnyAction, callback: (go: boolean) => void): boolean {
    switch (result.type) {
      case 'deny':
        callback(false)
        this.locked = false
        return true
      case 'redirect':
        callback(false)
        this.locked = false
        if (result.push) {
          this.push(result.path)
        } else {
          this.replace(result.path)
        }

        return true
      case 'error':
        callback(false)
        this.setView(result)
        this.locked = false
        return true
      default:
        return false
    }
  }

  private computeParams(
    historyLocation: HistoryLocation,
    historyAction: HistoryAction,
    deep = false): CachedParams {
    const branch = this.routes.match(historyLocation.pathname)
    const { route, match } = branch[branch.length - 1]
    let shallow = false
    const current = this.current
    if (!deep) {
      if (current && current.route) {
        shallow = current.route === route || !!route.id && current.route.id === route.id
      }
    }

    const location = fromHistoryLocation(historyLocation)
    const href = this.history.createHref(historyLocation)
    let hashChangeOnly = false
    let routeState = {}
    if (!deep && current) {
      hashChangeOnly = isOnlyHashChange(current.href, href)
      if (shallow && !route.stateless) {
        routeState = current.state
      }
    }

    let session: JObject
    if (route.id in this.session) {
      session = this.session[route.id]
    } else {
      session = {}
      if (!route.stateless) {
        this.session[route.id] = session
      }
    }

    const params: ActionParams = {
      action: historyAction,
      location,
      href,
      match,
      route,
      branch,
      shallow,
      state: routeState,
      session,
      router: this,
      app: this.app
    }

    const state: RouterState = {
      ...params,
      controller: null
    }

    return {
      action: historyAction,
      location: { ...historyLocation },
      params,
      state,
      hashChangeOnly
    }
  }

  private setView(view: RouterView): void {
    this.fallbackSetter.cancel()
    this.__setView(view)
  }

  private async enterView
    (view: View, params: ActionParams): Promise<AnyAction> {
    if (view && view.dependencies) {
      this.app.extend(view.dependencies as any)
    }

    return await resolveActions(
      view,
      params,
      view.onEnter,
      this.fallbackSetter,
      this.fallbackComputed)
  }

  private async enterController
    (ctor: ControllerConstructor, params: ActionParams, state: RouterState): Promise<AnyAction> {
    const { app, controllersPath } = this
    const { route } = params
    const dict = app as Dictionary
    let controller: Controller = dict[controllersPath] && dict[controllersPath][route.id]
    if (!controller && ctor) {
      app.extend({
        [controllersPath]: {
          [route.id]: ctor
        }
      })

      controller = dict[controllersPath] && dict[controllersPath][route.id]
    }

    if (!controller) {
      warning(false, `Controller for route '${route.id}' could not be instantiated.`)
      return notFound
    }

    (state as Dictionary).controller = controller
    return await resolveActions(
      controller,
      params,
      controller.onEnter,
      this.fallbackSetter,
      this.fallbackComputed) as ControllerAction
  }

  private async beforeEnter(
    nextLocation: HistoryLocation,
    nextAction: HistoryAction,
    callback: (go: boolean) => void,
    deep = false) {
    if (this.locked) {
      callback(false)
      return
    }

    const cached = this.computeParams(nextLocation, nextAction, deep)
    this.cachedParams = cached
    if (cached.hashChangeOnly) {
      callback(true)
      return
    }

    this.locked = true
    const { params } = cached
    let called = false
    try {
      const controller = this.currentController
      if (controller && controller.beforeLeave) {
        const action = await resolveActions(
          controller,
          params,
          controller.beforeLeave,
          this.fallbackSetter,
          this.fallbackComputed)
        if (this.terminate(action, callback)) {
          return
        }
      }

      const { route } = params
      if (route.beforeEnter) {
        const action = await resolveActions(
          route,
          params,
          route.beforeEnter,
          this.fallbackSetter,
          this.fallbackComputed)
        if (this.terminate(action, callback)) {
          return
        }
      }

      this.locked = false
      called = true
      callback(true)
    } finally {
      if (!called) {
        this.locked = false
        callback(false)
      }
    }
  }

  private async onEnter(historyLocation: HistoryLocation, historyAction: HistoryAction) {
    if (this.locked) {
      return
    }

    let cached = this.cachedParams
    this.cachedParams = null
    if (!cached || !locationsEqual(cached.location, historyLocation) || cached.action !== historyAction) {
      cached = this.computeParams(historyLocation, historyAction)
    }

    const { params, state } = cached
    const { route } = state
    const previous = this.current
    this.current = state

    if (cached.hashChangeOnly) {
      this.scrollTo(state.href)
      this.emitCurrent(previous)
      return
    }

    this.locked = true
    this.app.emit('router.onEnter')

    const finalize = (view: RouterView | null) => {
      this.setView(view || notFound)
      this.locked = false
      this.emitCurrent(previous)
      this.app.emit('router.afterEnter')
    }

    if (!params.shallow && previous.controller && previous.controller.onLeave) {
      try {
        previous.controller.onLeave(params)
      } catch (e) {
        finalize(error(500, e))
        return
      }
    }

    const enter = async (action: AnyAction, routerView: RouterView | null) => {
      try {
        switch (action.type) {
          case 'deny':
            finalize(forbidden)
            return
          case 'error':
            finalize(action)
            return
          case 'redirect':
            this.app.emit('router.onRedirect')
            this.locked = false
            if (action.push) {
              this.push(action.path)
            } else {
              this.replace(action.path)
            }

            return
          case 'controller':
            if (routerView) {
              finalize(routerView)
              return
            }

            let result = await this.enterController(action.controller, params, state)
            if (result.type === 'allow' && action.defaultAction) {
              result = action.defaultAction
            }

            await enter(result, null)
            return
          case 'view':
            if (routerView) {
              finalize(routerView)
              return
            }

            await enter(await this.enterView(action.view, params), action)
            return
          case 'allow':
          default:
            finalize(routerView)
            return
        }
      } catch (e) {
        finalize(error(500, e))
        this.locked = false
        this.emitCurrent(previous)
      }
    }

    const routeAction = route.onEnter
      ? await resolveActions(
        route,
        params,
        route.onEnter,
        this.fallbackSetter,
        this.fallbackComputed)
      : notFound

    await enter(routeAction, null)
  }

  constructor(state: JValue, app: AppNode, env: RouterEnv) {
    state = (state || {}) as JObject
    const self = this
    this.view = null
    this.app = app
    this.controllersPath = env.controllersPath || 'controllers'
    this.fallbackComputed = typeof env.fallbackComputed !== 'undefined'
      ? env.fallbackComputed
      : false
    this.routes = new RouteCollection(env.routes)
    this.session = (state.session as SessionType) || {}
    const history = env.createHistory({
      ...buildOptions(app, env.historyProps),
      getUserConfirmation
    })

    this.history = history

    let nextLocation = history.location
    let nextAction = history.action

    let fallbackDelay = env.fallbackDelay
    if (typeof fallbackDelay !== 'number' || !isFinite(fallbackDelay) || fallbackDelay < 0) {
      fallbackDelay = 500
    }

    this.fallbackSetter = throttle((fallback: FallbackView) => {
      this.__setView({
        type: 'fallback',
        fallback
      })
    }, fallbackDelay, { leading: false, trailing: true })

    function getUserConfirmation(_: string, callback: (go: boolean) => void) {
      self.beforeEnter(nextLocation, nextAction, callback)
    }

    this.unblock = history.block((location, action) => {
      nextLocation = location
      nextAction = action
      return 'Cannot perform this action.'
    })

    this.unlisten = history.listen((location, action) => this.onEnter(location, action))
    this.current = this.computeParams(history.location, history.action).state
    if (state.state) {
      (this.current as any).state = (state.state as JObject) || {}
    }
  }

  view: RouterView
  current: RouterState

  push(path: Path): void {
    if (this.locked) {
      return
    }

    this.history.push(toHistoryLocation(path, this.history.location))
  }

  replace(path: Path): void {
    if (this.locked) {
      return
    }

    this.history.replace(toHistoryLocation(path, this.history.location))
  }

  navigate(path: Path): void {
    if (typeof window !== 'undefined') {
      window.location.replace(this.createHref(path))
    } else {
      this.replace(path)
    }
  }

  reload(deep = false): Promise<void> {
    if (this.locked) {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      const { location, action } = this.history
      this.beforeEnter(location, action, async (go: boolean) => {
        if (go) {
          try {
            await this.onEnter(location, action)
          } catch (e) {
            return reject(e)
          }
        }

        return resolve()
      }, deep)
    })
  }

  goBack(): void {
    if (this.locked) {
      return
    }

    this.history.goBack()
  }

  goForward(): void {
    if (this.locked) {
      return
    }

    this.history.goForward()
  }

  scrollTo(href: string): void {
    const [, hash] = href.split('#')
    if (typeof hash === 'undefined') {
      return
    }

    if (hash === '') {
      if (typeof window !== 'undefined') {
        window.scrollTo(0, 0)
      }

      return
    }

    if (typeof document === 'undefined') {
      return
    }

    const idEl = document.getElementById(hash)
    if (idEl) {
      idEl.scrollIntoView()
      return
    }

    const nameEl = document.getElementsByName(hash)[0]
    if (nameEl) {
      nameEl.scrollIntoView()
    }
  }

  prefetch(path: Path): Promise<void> {
    if (dataSaving()) {
      return Promise.resolve()
    }

    const { pathname } = toHistoryLocation(path, this.history.location)
    const branch = this.routes.match(pathname)
    if (!branch || branch.length === 0) {
      return Promise.resolve()
    }

    const { route } = branch[branch.length - 1]
    const promises =
      toArray<DelayableAction<AnyAction>>(route.beforeEnter)
        .concat(toArray(route.onEnter))
        .reduce((promises: Array<Promise<any>>, action) => {
          if (typeof action === 'object' && action.type === 'lazy') {
            promises.push(action.value())
          }

          return promises
        }, [])

    return Promise.all(promises).then(noop)
  }

  isActive(path: Path): boolean {
    const currentRoute = this.current.route
    if (currentRoute.isError) {
      return false
    }

    const { pathname } = toHistoryLocation(path, this.history.location)
    return !!matchPath(pathname, currentRoute)
  }

  createHref(path: Path): string {
    return this.history.createHref(toHistoryLocation(path, this.history.location))
  }

  registerRoutes(routes: RoutingTable): void {
    this.routes.registerRoutes(routes)
  }

  toJSON(): JObject {
    const { current } = this
    const result: JObject = {}
    if (current.route && !current.route.stateless) {
      result.state = current.state
    }

    result.session = this.session || {}
    return result
  }

  dispose() {
    this.unlisten()
    this.unblock()
  }
}
