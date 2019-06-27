import { AppNode, ServiceDependencies, AppOptions } from '@pema/app'
import { JObject, Dictionary, ErrorLike } from '@pema/utils'
import { History } from 'history'

export type PathTuple = [string, JObject?, string?]

export interface PathObject {
  readonly path: string
  readonly query?: JObject
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

export type RouterView =
  | { type: 'view', view: View, status?: number }
  | { type: 'fallback', fallback: FallbackView }
  | { type: 'error', code: number, error?: ErrorLike }
  | null

export type Computed<T, TParams extends ActionParams = ActionParams> = (params: TParams, state: Dictionary) => (T | Promise<T>)

export type Delayed<T, TParams extends ActionParams = ActionParams> = Promise<T> | Computed<T, TParams>

export type LazyResolver<T, TParams extends ActionParams = ActionParams> = () => Promise<T | DelayedResult<T, TParams>>

type IsResult = { __result: true }

export type ViewResult
  = IsResult & { type: 'view', view: View, status?: number }

export type RedirectResult
  = IsResult & { type: 'redirect', path: Path, push?: boolean }

export type ErrorResult
  = IsResult & { type: 'error', code: number, error?: ErrorLike }

export type ControllerResult
  = IsResult & { type: 'controller', controller: ControllerConstructor }

export type AllowResult
  = IsResult & { type: 'allow' }

export type DenyResult
  = IsResult & { type: 'deny' }

export type DelayedResult<T, TParams extends ActionParams = ActionParams>
  = IsResult & { type: 'delay', value: Delayed<T, TParams>, fallback?: FallbackView }

export type LazyResult<T, TParams extends ActionParams = ActionParams>
  = IsResult & { type: 'lazy', value: LazyResolver<T, TParams>, fallback?: FallbackView }

export type ControllerAction =
  | DenyResult
  | ViewResult
  | RedirectResult
  | ErrorResult

export type ViewAction =
  | AllowResult
  | DenyResult
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

export type AnyAction =
  | ControllerAction
  | ViewAction
  | TransitionAction
  | RouteAction

export type DelayableAction<T extends AnyAction, TParams extends ActionParams = ActionParams>
  = T | Computed<T, TParams> | DelayedResult<T, TParams> | LazyResult<T, TParams>

export type FallbackView = any

type SingleOrArray<T> = T | T[]

export interface View<TProps extends ActionParams = ActionParams> {
  dependencies?: ServiceDependencies
  onEnter?: SingleOrArray<
    | DelayableAction<ViewAction, TProps>
    | DelayedResult<void, TProps>
    | Computed<void, TProps>>
  [key: string]: any
}

export interface ControllerConstructor<TController extends ControllerBase = ControllerBase> {
  dependencies?: ServiceDependencies
  new(state: any, app: any, env: any): TController
}

export interface ControllerBase {
  onEnter: DelayableAction<ControllerAction, any> | DelayableAction<AnyAction, any>[]
  beforeLeave?: DelayableAction<TransitionAction, any>
  onLeave?(params: any): void
}

export interface Controller<TProps extends ActionParams = ActionParams> extends ControllerBase {
  onEnter: DelayableAction<ControllerAction, TProps> | DelayableAction<AnyAction, TProps>[]
  beforeLeave?: DelayableAction<TransitionAction, TProps>
  onLeave?(params: TProps): void
}

export interface Location extends PathObject {
  readonly path: string
  readonly query: JObject
  readonly hash: string
}

export interface ActionParams<TApp extends AppNode = AppNode> {
  readonly action: 'PUSH' | 'REPLACE' | 'POP'
  readonly location: PathObject
  readonly href: string
  readonly match: Match
  readonly route: KeyedRouteConfig
  readonly branch: MatchedRoute[]
  readonly state: JObject
  readonly session: JObject
  readonly shallow: boolean
  readonly router: Router
  readonly app: TApp
}

export interface RouterState extends ActionParams {
  readonly controller: Controller | null
}

export interface Router {
  readonly current: RouterState
  readonly view: RouterView
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
  [key: string]: RouteConfig | DelayableAction<RouteAction> | DelayableAction<AnyAction>[]
}

export interface RouteConfig {
  __result?: never
  length?: never

  exact?: boolean
  strict?: boolean
  sensitive?: boolean
  order?: number
  stateless?: boolean
  routes?: RoutingTable
  beforeEnter?: DelayableAction<TransitionAction> | DelayableAction<AnyAction>[]
  onEnter?: DelayableAction<RouteAction> | DelayableAction<AnyAction>[]
  [key: string]: any
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
  historyProps?: AppOptions<HistoryBuildOptions>
  controllersPath?: string
  fallbackDelay?: number
}
