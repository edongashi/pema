export interface UseQueryOptions {
  active?: boolean
  allowPolling?: boolean
}

export interface QueryState<TResult> {
  data: TResult
  loading: boolean
  error: boolean
}

export interface QueryResult<TResult> extends QueryState<TResult> {
  refetch(): void
  ready: boolean
}
