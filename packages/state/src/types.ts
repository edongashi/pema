export interface QueryErrorContext<TResult = any, TApp = any> {
  error: any
  app: TApp
  apiClient: ApiClient
  query: Query<TResult>
}

export interface Query<TResult, TApp = any> {
  readonly resource: string
  readonly params?: {}
  readonly factory?: any
  readonly cache?: boolean | number
  readonly progress?: boolean
  readonly onError?: (context: QueryErrorContext<TResult, TApp>) => void
  fetch(app: TApp): Promise<TResult>
}

interface ActionContext<TParams, TResult, TApp> {
  params: TParams
  app: TApp
  apiClient: ApiClient
  action: Action<TParams, TResult>
}

export interface PostActionContext<TParams, TResult, TApp>
  extends ActionContext<TParams, TResult, TApp> {
  result: TResult
}

export interface FailedActionContext<TParams, TResult, TApp>
  extends ActionContext<TParams, TResult, TApp> {
  error: TApp
}

interface UpdateContext {
  resource: string
  value: any
}

export interface ActionUpdateContext<TParams, TResult, TApp>
  extends ActionContext<TParams, TResult, TApp>, UpdateContext { }

export interface PostActionUpdateContext<TParams, TResult, TApp>
  extends PostActionContext<TParams, TResult, TApp>, UpdateContext { }

export interface FailedActionUpdateContext<TParams, TResult, TApp>
  extends FailedActionContext<TParams, TResult, TApp>, UpdateContext { }

export type OptimisticActionUpdate<TParams, TResult, TApp> =
  (context: ActionUpdateContext<TParams, TResult, TApp>) => any

export type PostActionUpdate<TParams, TResult, TApp> =
  (context: PostActionUpdateContext<TParams, TResult, TApp>) => any

export type FailedActionUpdate<TParams, TResult, TApp> =
  (context: FailedActionUpdateContext<TParams, TResult, TApp>) => any

export interface OptimisticUpdateMap<TParams, TResult, TApp> {
  [resource: string]: OptimisticActionUpdate<TParams, TResult, TApp>
}

export interface PostActionUpdateMap<TParams, TResult, TApp> {
  [resource: string]: PostActionUpdate<TParams, TResult, TApp>
}

export interface FailedActionUpdateMap<TParams, TResult, TApp> {
  [resource: string]: FailedActionUpdate<TParams, TResult, TApp>
}

type MaybeComputed<T, TContext> = T | ((context: TContext) => T)

export interface Schema<TParams> {
  validate(params: TParams): Promise<TParams>
  validateSync(params: TParams): TParams
  isValid(params: TParams): Promise<boolean>
  isValidSync(params: TParams): boolean
}

export interface Action<TParams = void, TResult = void, TApp = any> {
  readonly progress?: MaybeComputed<
    boolean,
    ActionContext<TParams, TResult, TApp>
  >
  readonly optimistic?: MaybeComputed<
    OptimisticUpdateMap<TParams, TResult, TApp>,
    ActionContext<TParams, TResult, TApp>
  >
  readonly onSuccess?: MaybeComputed<
    PostActionUpdateMap<TParams, TResult, TApp>,
    PostActionContext<TParams, TResult, TApp>
  >
  readonly onError?: MaybeComputed<
    FailedActionUpdateMap<TParams, TResult, TApp>,
    FailedActionContext<TParams, TResult, TApp>
  >
  readonly invalidates?: MaybeComputed<
    string[],
    PostActionContext<TParams, TResult, TApp>
  >
  readonly schema?: Schema<TParams>
  perform(params: TParams, TApp: TApp): Promise<TResult>
}

export interface QueryOptions {
  allowProgress?: boolean
  allowErrorCallback?: boolean
  lookupCache?: boolean
  dedupe?: boolean
}

export interface ApiClient {
  invalidate(resources: string[] | string, refetch?: boolean): void
  refetch(resources: string[] | string): void
  lookup<TResult>(query: Query<TResult>): TResult | undefined
  query<TResult>(query: Query<TResult>, options?: QueryOptions): Promise<TResult>
  action<TParams, TResult>(action: Action<TParams, TResult>, params: TParams): Promise<TResult>
}
