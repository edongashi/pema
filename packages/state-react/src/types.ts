export interface UseQueryOptions {
  active?: boolean
  pollInterval?: number
  pollCache?: boolean
}

export interface QueryState<TResult> {
  data: TResult
  loading: boolean
  error: boolean
}

export interface QueryResult<TResult> extends QueryState<TResult> {
  refetch(lookupCache?: boolean): void
  ready: boolean
}
