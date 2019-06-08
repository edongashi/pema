import {
  Router,
  RouterState,
  PathObject,
  PathTuple,
  Path,
  Controller,
  RouterView,
  AnyAction,
  RouterEnv,
  RouteAction,
  DelayableAction,
  ControllerAction,
  ActionParams,
  ControllerConstructor,
  RoutingTable,
  ViewResult,
  ErrorResult,
  FallbackView
} from './types'
import {
  toArray,
  noop,
  buildProps,
  warning,
  JObject,
  Dictionary
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
import { error } from './actions'
import resolveActions from './resolve-actions';

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
const internalError = error(500)

class RouterImpl implements Router {
  private readonly app: AppNode
  private readonly routes: RouteCollection
  private readonly controllersPath: string
  private readonly history: History
  private readonly unblock: () => void
  private readonly unlisten: () => void
  private readonly fallbackSetter: ViewSetter

  private readonly session: SessionType
  private locked: boolean = false
  private cachedParams: CachedParams | null = null

  private get currentController(): Controller | null {
    return this.current && this.current.controller || null
  }

  private __setView(routerView: RouterView): void {
    this.view = routerView
    this.app.emit('router.view', routerView)
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
        this.enterError(result)
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

  private enterError(errorResult: ErrorResult): void {
    this.fallbackSetter.cancel()
    this.__setView(errorResult)
  }

  private enterView(viewResult: ViewResult): void {
    this.fallbackSetter.cancel()
    const { view } = viewResult
    if (view && typeof view.dependencies === 'object') {
      this.app.extend(view.dependencies)
    }

    this.__setView(viewResult) // todo
  }

  private async enterController
    (ctor: ControllerConstructor, state: RouterState, params: ActionParams): Promise<boolean> {
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
      this.enterError(notFound)
      return true
    }

    (state as Dictionary).controller = controller

    if (typeof controller.onEnter !== 'function') {
      warning(false, `Controller for route '${route.id}' has no entry action.`)
      this.enterError(notFound)
      return true
    }

    let result: DelayableAction<ControllerAction>
    try {
      result = await controller.onEnter(params)
      warning(result, `Controller for route '${route.id}' has no entry action.`)
    } catch (e) {
      warning(false, `Controller for route '${route.id}' threw an error during entry.`)
      this.enterError(internalError)
      return true
    }

    const controllerAction =
      await resolveActions(params, result, this.fallbackSetter) as ControllerAction

    switch (controllerAction.type) {
      case 'view':
        this.enterView(controllerAction)
        return true
      case 'redirect':
        if (controllerAction.push) {
          this.push(controllerAction.path)
        } else {
          this.replace(controllerAction.path)
        }

        return false
      case 'error':
        this.enterError(controllerAction)
        return true
      case 'deny':
        this.enterError(forbidden)
        return true
      default:
        warning(false, `Invalid result from '${route.id}' controller.`)
        this.enterError(notFound)
        return true
    }
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
    try {
      const controller = this.currentController
      if (controller && controller.beforeLeave) {
        const action = await resolveActions(params, controller.beforeLeave(params), this.fallbackSetter)
        if (this.terminate(action, callback)) {
          return
        }
      }

      const { route } = params
      if (route.beforeEnter) {
        const action = await resolveActions(params, route.beforeEnter, this.fallbackSetter)
        if (this.terminate(action, callback)) {
          return
        }
      }

      this.locked = false
      callback(true)
    } finally {
      callback(false)
      this.locked = false
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

    if (!params.shallow && previous.controller && previous.controller.onLeave) {
      try {
        previous.controller.onLeave(params)
      } catch (e) {
        warning(false, `Controller for route '${previous.route.id}' threw an error during exit.`)
      }
    }

    if (!route.onEnter) {
      warning(false, 'onEnter action is required for routes.')
      this.enterError(notFound)
      return
    }

    this.locked = true
    const action = await resolveActions(params, route.onEnter, this.fallbackSetter) as RouteAction
    let shouldEmit = true
    try {
      switch (action.type) {
        case 'view':
          this.enterView(action)
          this.locked = false
          return
        case 'redirect':
          shouldEmit = false
          this.locked = false
          if (action.push) {
            this.push(action.path)
          } else {
            this.replace(action.path)
          }

          return
        case 'error':
          this.enterError(action)
          this.locked = false
          return
        case 'controller':
          const ended = await this.enterController(action.controller, state, params)
          shouldEmit = ended
          this.locked = false
          return
      }
    } catch (e) {
      this.locked = false
    } finally {
      if (shouldEmit) {
        this.emitCurrent(previous)
      }
    }
  }

  constructor(state: JObject, app: AppNode, env: RouterEnv) {
    const self = this
    this.view = null
    this.app = app
    this.controllersPath = env.controllersPath || 'controllers'
    this.routes = new RouteCollection(env.routes)
    this.session = (state.session as SessionType) || {}
    const history = env.createHistory({
      ...buildProps(app, env.historyProps),
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
    }, fallbackDelay, { trailing: true })

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

  push(path: string): void
  push(path: PathObject): void
  push(path: PathTuple): void
  push(path: Path): void
  push(path: Path): void {
    if (this.locked) {
      return
    }

    this.history.push(toHistoryLocation(path, this.history.location))
  }

  replace(path: string): void
  replace(path: PathObject): void
  replace(path: PathTuple): void
  replace(path: Path): void
  replace(path: Path): void {
    if (this.locked) {
      return
    }

    this.history.replace(toHistoryLocation(path, this.history.location))
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

  prefetch(path: string): Promise<void>
  prefetch(path: PathObject): Promise<void>
  prefetch(path: PathTuple): Promise<void>
  prefetch(path: Path): Promise<void>
  prefetch(path: Path): Promise<void> {
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

  createHref(path: string): string
  createHref(path: PathObject): string
  createHref(path: PathTuple): string
  createHref(path: Path): string
  createHref(path: Path): string {
    return this.history.createHref(toHistoryLocation(path, this.history.location))
  }

  registerRoutes(routes: RoutingTable): void {
    this.routes.registerRoutes(routes)
  }

  toJSON(): JObject {
    const { current } = this
    if (current.route && current.route.stateless) {
      return {}
    }

    return {
      state: current.state || {},
      session: this.session || {}
    }
  }

  dispose() {
    this.unlisten()
    this.unblock()
  }
}
