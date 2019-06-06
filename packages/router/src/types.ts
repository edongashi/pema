import { AppNode } from '@pema/app'
import { JObject, JValue } from '@pema/utils'
import { History } from 'history'

export type PathTuple = [string, JObject?, JValue?, string?]

export interface PathObject {
  readonly path: string
  readonly query?: JObject
  readonly state?: JValue
  readonly hash?: string
}

export type Path = string | PathObject | PathTuple

export interface RouteParams {
  [key: string]: string
}

export interface Match {
  params: RouteParams
  isExact: boolean
  path: string
  url: string
}

export interface ControllerConstructor {
  new(state: JValue, app: any): Controller
}

export type View = any

export type ViewResult = { type: 'view', view: View, status?: number }
export type RedirectResult = { type: 'redirect', path: Path, push?: boolean }
export type ErrorResult = { type: 'error', code: number, error?: JValue }
export type ControllerResult = { type: 'controller', controller: ControllerConstructor }
export type AllowResult = { type: 'allow' }
export type DenyResult = { type: 'deny' }

export type EnterAction =
  | DenyResult
  | ViewResult
  | RedirectResult
  | ErrorResult

export type TransitionAction =
  | AllowResult
  | DenyResult
  | RedirectResult
  | ErrorResult

export type RouteAction =
  | ViewResult
  | RedirectResult
  | ControllerResult
  | ErrorResult

export type Delayed<T> = Promise<T> | ((params: ActionParams) => T) | ((arg: ActionParams) => Promise<T>)

export type DelayedResult<T>
  = { type: 'delay', value: Delayed<T>, fallback?: View }

export type LazyResolver<T> = () => Promise<T | DelayedResult<T>>

export type LazyResult<T>
  = { type: 'lazy', value: LazyResolver<T>, fallback?: View }

export type AnyAction = EnterAction | TransitionAction | RouteAction

export type DelayableAction<T extends AnyAction>
  = T | DelayedResult<T> | LazyResult<T>

export interface Controller {
  onEnter(params: ActionParams): DelayableAction<EnterAction>
  onShallowEnter?(params: ActionParams): DelayableAction<TransitionAction>
  beforeLeave?(params: ActionParams): DelayableAction<TransitionAction>
  onLeave?(params: ActionParams): void
}

export interface Location extends PathObject {
  readonly path: string
  readonly query: JObject
  readonly state: JValue
  readonly validState: boolean
  readonly hash: string
}

export interface RouterStateBase {
  readonly action: 'PUSH' | 'REPLACE' | 'POP'
  readonly location: PathObject
  readonly href: string
  readonly match: Match
  readonly route: KeyedRouteConfig
  readonly branch: MatchedRoute[]
  readonly state: JObject
  readonly session: JObject
}

export interface ActionParams extends RouterStateBase {
  readonly shallow: boolean
  readonly router: Router
  readonly app: AppNode
}

export interface RouterState extends RouterStateBase {
  readonly controller: Controller | null
}

export interface Router {
  readonly current: RouterState
  readonly view: View
  push(path: string): void
  push(path: PathObject): void
  push(path: PathTuple): void
  replace(path: string): void
  replace(path: PathObject): void
  replace(path: PathTuple): void
  reload(deep?: boolean): Promise<void>
  goBack(): void
  goForward(): void
  scrollTo(href: string): void
  prefetch(path: string): Promise<void>
  prefetch(path: PathObject): Promise<void>
  prefetch(path: PathTuple): Promise<void>
  createHref(path: string): string
  createHref(path: PathObject): string
  createHref(path: PathTuple): string
  registerRoutes(routes: RoutingTable): void
  dispose(): void
}

export interface RoutingTable {
  [key: string]: RouteConfig
}

export interface RouteConfig {
  exact?: boolean
  strict?: boolean
  sensitive?: boolean
  order?: number
  stateless?: boolean
  routes?: RoutingTable
  beforeEnter?: DelayableAction<TransitionAction> | DelayableAction<TransitionAction>[]
  onEnter?: DelayableAction<RouteAction> | DelayableAction<RouteAction>[]
  [propName: string]: any
}

export interface KeyedRouteConfig extends RouteConfig {
  id: string
  path: string
  keyedRoutes?: KeyedRouteConfig[]
}

export interface MatchOptions {
  path: string | string[]
  exact?: boolean
  strict?: boolean
  sensitive?: boolean
}

export interface MatchedRoute {
  route: KeyedRouteConfig
  match: Match
}

export interface HistoryBuildOptions {
  basename?: string
  getUserConfirmation?: (message: string, callback: (result: boolean) => void) => void
  [key: string]: any
}

export interface RouterEnv {
  routes: RoutingTable
  createHistory: (options: HistoryBuildOptions) => History
  historyProps?: HistoryBuildOptions
  controllersPath?: string
  fallbackDelay?: number
}
