export interface Query<TResult> {
  readonly resource?: string
  readonly cache?: boolean | number
  readonly progress?: boolean
  readonly params?: {}
  readonly pollInterval?: number
  readonly pollCache?: boolean
  fetch(app: any): Promise<TResult>
}

export interface Action<TParams, TResult> {
  readonly invalidates?: string[] | ((params: TParams, app: any) => string[])
  readonly progress?: boolean
  perform(params: TParams, app: any): Promise<TResult>
}

export interface ApiClient {
  invalidate(resources: string[] | string): void
  lookup<TResult>(query: Query<TResult>): TResult | undefined
  query<TResult>(query: Query<TResult>, lookup?: boolean): Promise<TResult>
  action<TParams, TResult>(action: Action<TParams, TResult>, params: TParams): Promise<TResult>
}
