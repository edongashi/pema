import { JObject, JValue, AppNode } from '@pema/app'
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
export type ErrorResult = { type: 'error', error: any }
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

export interface RouteConfig {
  path: string
  exact?: boolean
  strict?: boolean
  routes?: RouteConfig[]
  beforeEnter?: DelayableAction<TransitionAction> | DelayableAction<TransitionAction>[]
  onEnter: DelayableAction<RouteAction> | DelayableAction<RouteAction>[]
  [propName: string]: any
}

export interface NamedRouteConfig extends RouteConfig {
  name: string
}

export interface Controller {
  onEnter(params: ActionParams): DelayableAction<EnterAction>
  onShallowEnter?(params: ActionParams): DelayableAction<TransitionAction>
  beforeLeave?(params: ActionParams): DelayableAction<TransitionAction>
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
  readonly match: Match
  readonly route: NamedRouteConfig
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
  refresh(deep?: boolean): Promise<void>
  goBack(): void
  goForward(): void
  prefetch(path: string): Promise<void>
  prefetch(path: PathObject): Promise<void>
  prefetch(path: PathTuple): Promise<void>
  createHref(path: string): string
  createHref(path: PathObject): string
  createHref(path: PathTuple): string
  dispose(): void
}

export interface MatchOptions {
  path: string | string[]
  exact?: boolean
  strict?: boolean
  sensitive?: boolean
}

export interface MatchedRoute {
  route: RouteConfig
  match: Match
}

export interface NamedMatchedRoute extends MatchedRoute {
  route: NamedRouteConfig
}

export interface RouteCollection {
  match(path: string): NamedMatchedRoute
}

export interface HistoryBuildOptions {
  basename?: string
  getUserConfirmation?: (message: string, callback: (result: boolean) => void) => void
  [key: string]: any
}

export interface RouterEnv {
  routes: RouteCollection
  createHistory: (options: HistoryBuildOptions) => History
  historyProps?: HistoryBuildOptions
  controllersPath?: string
  fallbackDelay?: number
}
