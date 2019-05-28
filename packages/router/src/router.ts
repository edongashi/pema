import {
  Router,
  RouterState,
  PathObject,
  PathTuple,
  Path,
  Controller,
  RouteCollection,
  View,
  AnyAction,
  RouterEnv,
  RouteAction,
  DelayableAction,
  EnterAction,
  ActionParams,
  ControllerConstructor
} from './types'
import {
  History,
  Location as HistoryLocation,
  Action as HistoryAction
} from 'history'
import {
  getProps,
  warning,
  JObject,
  AppNode,
  Dictionary
} from '@pema/app'
import throttle from 'lodash.throttle'
import { resolveActions, toArray, noop, toHistoryLocation, fromHistoryLocation, locationsEqual } from './utils'

interface ViewSetter {
  (view: View): void
  cancel(): void
}

interface CachedParams {
  location: HistoryLocation
  action: 'PUSH' | 'REPLACE' | 'POP'
  params: ActionParams
  state: RouterState
}

class RouterImpl implements Router {
  private locked: boolean = false
  private readonly app: AppNode
  private readonly routes: RouteCollection
  private readonly controllersPath: string
  private readonly history: History
  private readonly unblock: () => void
  private readonly unlisten: () => void
  private readonly viewSetter: ViewSetter
  private cachedParams: CachedParams | null = null
  private get currentController(): Controller | null {
    return this.current && this.current.controller || null
  }

  private __setView(view: View): void {
    this.view = view
    this.app.emit('router.view', {
      view,
      app: this.app,
      router: this
    })
  }

  private forceView(view: View): void {
    this.viewSetter.cancel()
    this.__setView(view)
  }

  private forceError(view: View): void {
    this.viewSetter.cancel()
    this.__setView(view)
  }

  private computeParams(
    historyLocation: HistoryLocation,
    historyAction: HistoryAction,
    deep = false) {
    const { route, match } = this.routes.match(historyLocation.pathname)
    let shallow = false
    if (!deep) {
      const current = this.current
      if (current && current.route) {
        shallow = current.route === route || !!route.name && current.route.name === route.name
      }
    }

    const location = fromHistoryLocation(historyLocation)
    const params: ActionParams = {
      action: historyAction,
      location,
      match,
      route,
      shallow,
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
      state
    }
  }

  private async enterController(ctor: ControllerConstructor, state: RouterState, params: ActionParams) {
    const { app, controllersPath } = this
    const { route } = params
    const dict = app as Dictionary
    let controller: Controller = dict[controllersPath] && dict[controllersPath][route.name]
    if (!controller && ctor) {
      app.extend({
        [controllersPath]: {
          [route.name]: ctor
        }
      })

      controller = dict[controllersPath] && dict[controllersPath][route.name]
    }

    if (!controller) {
      warning(false, `Controller for route '${route.name}' could not be instantiated.`)
      this.forceView(null)
      return
    }

    (state as Dictionary).controller = controller

    if (typeof controller.onEnter !== 'function') {
      warning(false, `Controller for route '${route.name}' has no entry action.`)
      this.forceView(null)
      return
    }

    let result: DelayableAction<EnterAction>
    try {
      result = await controller.onEnter(params)
      warning(result, `Controller for route '${route.name}' has no entry action.`)
    } catch (e) {
      warning(false, `Controller for route '${route.name}' threw an error during entry.`)
      this.forceError(e)
      return
    }

    const controllerAction =
      await resolveActions(params, result, this.viewSetter) as EnterAction

    switch (controllerAction.type) {
      case 'view':
        this.forceView(controllerAction.view)
        return
      case 'redirect':
        if (controllerAction.push) {
          this.push(controllerAction.path)
        } else {
          this.replace(controllerAction.path)
        }

        return
      case 'error':
        this.forceError(controllerAction.error)
        return
      case 'deny':
        this.forceView(null)
        return
      default:
        warning(false, `Invalid result from '${route.name}' controller.`)
        this.forceView(null)
        return
    }
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
        this.locked = false
        this.forceError(result.error)
        return true
      default:
        return false
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

    const cachedParams = this.computeParams(nextLocation, nextAction, deep)
    const { params } = cachedParams
    this.cachedParams = cachedParams
    this.locked = true
    try {
      const controller = this.currentController
      if (controller && controller.beforeLeave) {
        const action = await resolveActions(params, controller.beforeLeave(params), this.viewSetter)
        if (this.terminate(action, callback)) {
          return
        }
      }

      const { route } = params
      if (route.beforeEnter) {
        const action = await resolveActions(params, route.beforeEnter, this.viewSetter)
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
    if (!cached || !locationsEqual(cached.location, historyLocation) || cached.action !== historyAction) {
      cached = this.computeParams(historyLocation, historyAction)
      this.cachedParams = null
    }

    const { params, state } = cached
    const { route } = state

    this.current = state
    if (!route.onEnter) {
      warning(false, 'onEnter action is required for routes.')
      this.forceView(null)
      return
    }

    this.locked = true
    try {
      const action = await resolveActions(params, route.onEnter, this.viewSetter) as RouteAction
      switch (action.type) {
        case 'view':
          this.forceView(action.view)
          return
        case 'redirect':
          if (action.push) {
            this.push(action.path)
          } else {
            this.replace(action.path)
          }

          return
        case 'error':
          this.forceError(action.error)
          return
        case 'controller':
          await this.enterController(action.controller, state, params)
          return
      }
    } finally {
      this.app.emit('router.location', {
        current: state,
        app: this.app,
        router: this
      })

      this.locked = false
    }
  }

  constructor(_: JObject, app: AppNode, env: RouterEnv) {
    const self = this
    this.app = app
    this.controllersPath = env.controllersPath || 'controllers'
    this.routes = env.routes
    const history = env.createHistory({
      ...getProps(app, env.historyProps),
      getUserConfirmation
    })

    this.history = history

    let nextLocation = history.location
    let nextAction = history.action

    let fallbackDelay = env.fallbackDelay
    if (typeof fallbackDelay !== 'number' || !isFinite(fallbackDelay) || fallbackDelay < 0) {
      fallbackDelay = 500
    }

    this.viewSetter = throttle((view: View) => {
      this.__setView(view)
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
  }

  view: View
  current: RouterState

  push(path: string): void
  push(path: PathObject): void
  push(path: PathTuple): void
  push(path: Path): void
  push(path: Path): void {
    this.history.push(toHistoryLocation(path, this.history.location))
  }

  replace(path: string): void
  replace(path: PathObject): void
  replace(path: PathTuple): void
  replace(path: Path): void
  replace(path: Path): void {
    this.history.replace(toHistoryLocation(path, this.history.location))
  }

  refresh(deep = false): Promise<void> {
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
    this.history.goBack()
  }

  goForward(): void {
    this.history.goForward()
  }

  prefetch(path: string): Promise<void>
  prefetch(path: PathObject): Promise<void>
  prefetch(path: PathTuple): Promise<void>
  prefetch(path: Path): Promise<void>
  prefetch(path: Path): Promise<void> {
    const { pathname } = toHistoryLocation(path, this.history.location)
    const match = this.routes.match(pathname)
    if (!match) {
      return Promise.resolve()
    }

    const route = match.route
    const promises =
      toArray<DelayableAction<AnyAction>>(route.beforeEnter)
        .concat(toArray(route.onEnter))
        .reduce((promises: Array<Promise<any>>, action) => {
          if (action.type === 'lazy') {
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

  dispose() {
    this.unlisten()
    this.unblock()
  }
}
