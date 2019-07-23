import { Schema } from '@pema/state'

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

type ActionFunc<TParams, TResult> =
  TParams extends void
  ? () => Promise<TResult>
  : (params: TParams) => Promise<TResult>

interface WithSchema<TParams> {
  schema: Schema<TParams>
}

export type ActionInvoker<TParams, TResult> =
  ActionFunc<TParams, TResult> & WithSchema<TParams>
