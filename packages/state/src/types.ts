export interface QueryErrorContext<TResult = any, TParams = void, TApp = any> {
  error: any
  app: TApp
  apiClient: ApiClient
  query: Query<TResult, TParams>
  params: TParams
}

export interface Query<TResult, TParams = void, TApp = any> {
  readonly resource: MaybeComputed<string, TParams>
  readonly cache?: MaybeComputed<boolean | number, TParams>
  readonly progress?: MaybeComputed<boolean, TParams>
  readonly onError?: (context: QueryErrorContext<TResult, TParams, TApp>) => void
  fetch(params: TParams, app: TApp): Promise<TResult>
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
  (params: TParams, context: ActionUpdateContext<TParams, TResult, TApp>) => any

export type PostActionUpdate<TParams, TResult, TApp> =
  (params: TParams, context: PostActionUpdateContext<TParams, TResult, TApp>) => any

export type FailedActionUpdate<TParams, TResult, TApp> =
  (params: TParams, context: FailedActionUpdateContext<TParams, TResult, TApp>) => any

export interface OptimisticUpdateMap<TParams, TResult, TApp> {
  [resource: string]: OptimisticActionUpdate<TParams, TResult, TApp>
}

export interface PostActionUpdateMap<TParams, TResult, TApp> {
  [resource: string]: PostActionUpdate<TParams, TResult, TApp>
}

export interface FailedActionUpdateMap<TParams, TResult, TApp> {
  [resource: string]: FailedActionUpdate<TParams, TResult, TApp>
}

export type MaybeComputed<T, TParams> = T | ((params: TParams) => T)

export interface Schema<TParams> {
  validate(params: TParams): Promise<TParams>
  validateSync(params: TParams): TParams
  isValid(params: TParams): Promise<boolean>
  isValidSync(params: TParams): boolean
}

export type MaybeComputedWithContext<T, TParams, TContext> =
  | T
  | ((params: TParams, context: TContext) => T)

export interface Action<TParams = void, TResult = void, TApp = any> {
  readonly progress?: MaybeComputedWithContext<
    boolean,
    TParams,
    ActionContext<TParams, TResult, TApp>
  >
  readonly eager?: MaybeComputedWithContext<
    boolean,
    TParams,
    ActionContext<TParams, TResult, TApp>
  >
  readonly optimistic?: MaybeComputedWithContext<
    OptimisticUpdateMap<TParams, TResult, TApp>,
    TParams,
    ActionContext<TParams, TResult, TApp>
  >
  readonly onSuccess?: MaybeComputedWithContext<
    PostActionUpdateMap<TParams, TResult, TApp>,
    TParams,
    PostActionContext<TParams, TResult, TApp>
  >
  readonly onError?: MaybeComputedWithContext<
    FailedActionUpdateMap<TParams, TResult, TApp>,
    TParams,
    FailedActionContext<TParams, TResult, TApp>
  >
  readonly invalidates?: MaybeComputedWithContext<
    string[],
    TParams,
    PostActionContext<TParams, TResult, TApp>
  >
  readonly schema?: Schema<TParams>
  perform(params: TParams, TApp: TApp): Promise<TResult>
}

export interface QueryOptions {
  allowProgress?: boolean
  lookupCache?: boolean
}

export interface ApiClient {
  invalidate(resources: string[] | string, refetch?: boolean): void
  refetch(resources: string[] | string): void
  lookup<TResult>(resource: string): TResult | undefined
  query<TResult>(query: Query<TResult>): Promise<TResult>
  query<TResult, TParams>(query: Query<TResult, TParams>, params: TParams, options?: QueryOptions): Promise<TResult>
  suspend<TResult>(query: Query<TResult>): TResult
  suspend<TResult, TParams>(query: Query<TResult, TParams>, params: TParams): TResult
  action<TResult>(action: Action<void, TResult>): Promise<TResult>
  action<TParams, TResult>(action: Action<TParams, TResult>, params: TParams): Promise<TResult>
}
