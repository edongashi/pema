export interface QueryErrorContext<TResult = any> {
  error: any
  app: any
  apiClient: ApiClient
  query: Query<TResult>
}

export interface Query<TResult> {
  resource?: string
  cache?: boolean | number
  progress?: boolean
  params?: {}
  onError?: (context: QueryErrorContext<TResult>) => void
  fetch(app: any): Promise<TResult>
}

interface ActionContext<TParams, TResult> {
  params: TParams
  app: any
  apiClient: ApiClient
  action: Action<TParams, TResult>
}

export interface PostActionContext<TParams, TResult>
  extends ActionContext<TParams, TResult> {
  result: TResult
}

export interface FailedActionContext<TParams, TResult>
  extends ActionContext<TParams, TResult> {
  error: any
}

interface UpdateContext {
  resource: string
  value: any
}

export interface ActionUpdateContext<TParams, TResult>
  extends ActionContext<TParams, TResult>, UpdateContext { }

export interface PostActionUpdateContext<TParams, TResult>
  extends PostActionContext<TParams, TResult>, UpdateContext { }

export interface FailedActionUpdateContext<TParams, TResult>
  extends FailedActionContext<TParams, TResult>, UpdateContext { }

export type OptimisticActionUpdate<TParams, TResult> =
  (context: ActionUpdateContext<TParams, TResult>) => any

export type PostActionUpdate<TParams, TResult> =
  (context: PostActionUpdateContext<TParams, TResult>) => any

export type FailedActionUpdate<TParams, TResult> =
  (context: FailedActionUpdateContext<TParams, TResult>) => any

export interface OptimisticUpdateMap<TParams, TResult> {
  [resource: string]: OptimisticActionUpdate<TParams, TResult>
}

export interface PostActionUpdateMap<TParams, TResult> {
  [resource: string]: PostActionUpdate<TParams, TResult>
}

export interface FailedActionUpdateMap<TParams, TResult> {
  [resource: string]: FailedActionUpdate<TParams, TResult>
}

type MaybeComputed<T, TContext> = T | ((context: TContext) => T)

export interface Schema<TParams> {
  validate(params: TParams): Promise<TParams>
}

export interface Action<TParams = void, TResult = void> {
  progress?: MaybeComputed<boolean, ActionContext<TParams, TResult>>
  optimistic?: MaybeComputed<OptimisticUpdateMap<TParams, TResult>, ActionContext<TParams, TResult>>
  onSuccess?: MaybeComputed<PostActionUpdateMap<TParams, TResult>, PostActionContext<TParams, TResult>>
  onError?: MaybeComputed<FailedActionUpdateMap<TParams, TResult>, FailedActionContext<TParams, TResult>>
  invalidates?: MaybeComputed<string[], PostActionContext<TParams, TResult>>
  schema?: Schema<TParams>
  perform(params: TParams, app: any): Promise<TResult>
}

export interface QueryOptions {
  allowProgress?: boolean
  allowErrorCallback?: boolean
  lookupCache?: boolean
}

export interface ApiClient {
  invalidate(resources: string[] | string): void
  refetch(resources: string[] | string): void
  lookup<TResult>(query: Query<TResult>): TResult | undefined
  query<TResult>(query: Query<TResult>, options?: QueryOptions): Promise<TResult>
  action<TParams, TResult>(action: Action<TParams, TResult>, params: TParams): Promise<TResult>
}
