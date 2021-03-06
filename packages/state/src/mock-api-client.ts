import { Action, Query } from './types'
import { CachedApiClient } from './cached-api-client'

type Func<TParams, TResult> =
  TParams extends void
  ? () => TResult
  : (params: TParams) => TResult

export class MockApiError extends Error {
  constructor(public readonly item: Action<any, any> | Query<any, any>) {
    super('Could not find mock implementation for action or query')
  }
}

export class MockApiClient extends CachedApiClient {
  private readonly queryMap: Map<any, (params: any) => any>
  private readonly actionMap: Map<any, (params: any) => any>

  constructor(state: any, app: any) {
    super(state, app)
    this.queryMap = new Map()
    this.actionMap = new Map()
  }

  protected fetch<TResult, TParams>(query: Query<TResult, TParams>, params: TParams): Promise<TResult> {
    const interceptor = this.queryMap.get(query)
    if (!interceptor) {
      throw new MockApiError(query)
    }

    return interceptor(params)
  }

  protected perform<TParams, TResult>(action: Action<TParams, TResult>, params: TParams): Promise<TResult> {
    const interceptor = this.actionMap.get(action)
    if (!interceptor) {
      throw new MockApiError(action)
    }

    return interceptor(params)
  }

  withQuery<TResult, TParams = void>(
    factory: Query<TResult, TParams>,
    result: Func<TParams, Promise<TResult>>
  ): this {
    this.queryMap.set(factory, result)
    return this
  }

  withAction<TParams = void, TResult = void>(
    action: Action<TParams, TResult>,
    result: Func<TParams, Promise<TResult>>
  ): this {
    this.actionMap.set(action, result)
    return this
  }
}
