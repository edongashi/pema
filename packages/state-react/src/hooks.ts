import { AppNode } from '@pema/app'
import { ApiClient, Action, Query, matchResource, Schema } from '@pema/state'
import { useApp } from '@pema/app-react'
import { useEffect, useState, useRef } from 'react'
import useDeepCompareEffect from 'use-deep-compare-effect'
import { ActionInvoker, QueryState, QueryResult, UseQueryOptions } from './types'

interface App extends AppNode {
  apiClient: ApiClient
}

const noParams = {}

export function useQuery<TResult>
  (query: Query<TResult>, options: UseQueryOptions = {}): QueryResult<TResult> {
  // Context
  const {
    active = true,
    pollInterval = 0,
    pollCache = false
  } = options
  const app = useApp<App>()

  // Fetch cycle
  // tslint:disable-next-line: variable-name
  const [fetchCycle, __setFetchCycle] = useState(0)
  const lookupCacheRef = useRef(true)
  function refetch(lookupCache = false) {
    lookupCacheRef.current = lookupCache
    __setFetchCycle(c => c + 1)
  }

  // State
  const initialData = fetchCycle === 0 ? app.apiClient.lookup(query) : undefined
  const [state, setState] = useState<QueryState<TResult>>({
    data: initialData as TResult,
    loading: typeof initialData === 'undefined',
    error: false
  })

  // Invalidation
  const resourceId = query.resource || '*'
  useEffect(() => {
    // Refetching
    function refetchHandler(pattern: string) {
      if (matchResource(pattern, resourceId)) {
        refetch(true)
      }
    }

    // Optimistic updates
    function mapHandler(pattern: string, map: (value: TResult) => TResult) {
      if (matchResource(pattern, resourceId)) {
        setState(current => (current.loading || current.error)
          ? current
          : { data: map(current.data), loading: false, error: false })
      }
    }

    app.events.on('apiClient.refetch', refetchHandler)
    app.events.on('apiClient.map', mapHandler)

    return () => {
      app.events.off('apiClient.refetch', refetchHandler)
      app.events.off('apiClient.map', refetchHandler)
    }
  }, [app, resourceId])

  // Polling
  const pollCacheRef = useRef(pollCache)
  useEffect(() => {
    pollCacheRef.current = pollCache
  }, [pollCache])

  useEffect(() => {
    if (!active || typeof pollInterval !== 'number' || pollInterval <= 0) {
      return
    }

    const timeoutId = setTimeout(() => refetch(pollCacheRef.current), pollInterval)
    return () => clearTimeout(timeoutId)
  }, [active, fetchCycle, pollInterval])

  // Fetching
  const queryRef = useRef(query)
  useEffect(() => {
    queryRef.current = query
  }, [query])

  useDeepCompareEffect(() => {
    if (!active) {
      return
    }

    async function fetch() {
      try {
        const data = await app.apiClient.query(queryRef.current, {
          allowProgress: fetchCycle === 0,
          lookupCache: lookupCacheRef.current
        })

        setState({
          data,
          loading: false,
          error: false
        })
      } catch {
        setState({
          data: (undefined as any) as TResult,
          loading: false,
          error: true
        })
      }
    }

    fetch()
  }, [active, fetchCycle, query.params || noParams])

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    refetch,
    ready: !state.loading && !state.error
  }
}

const dummySchema = {
  async validate(value: any) {
    return value
  },
  validateSync(value: any) {
    return value
  }
}

export function useAction
  <TParams, TResult>(action: Action<TParams, TResult>):
  ActionInvoker<TParams, TResult> {
  const app = useApp<App>()
  function invoke(params: TParams): Promise<TResult> {
    return app.apiClient.action(action, params)
  }

  const schema = action.schema || dummySchema
  invoke.schema = schema
  invoke.validate = (value: TParams) => schema.validate(value)
  invoke.validateSync = (value: TParams) => schema.validateSync(value)
  return (invoke as any) as ActionInvoker<TParams, TResult>
}
