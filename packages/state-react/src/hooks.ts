import { AppNode } from '@pema/app'
import { ApiClient, Action, Query, matchResource } from '@pema/state'
import { useApp } from '@pema/app-react'
import { useEffect, useState } from 'react'
import useDeepCompareEffect from 'use-deep-compare-effect'

interface App extends AppNode {
  apiClient: ApiClient
}

interface QueryState<TResult> {
  data: TResult
  loading: boolean
  error: boolean
}

interface QueryResult<TResult> extends QueryState<TResult> {
  refetch(): void
}

const noParams = {}

export function useQuery<TResult>
  (query: Query<TResult>): QueryResult<TResult> {
  const app = useApp<App>()
  const [tick, setTick] = useState(0)

  const initialData = tick === 0 ? app.apiClient.lookup(query) : undefined
  const [state, setState] = useState<QueryState<TResult>>({
    data: initialData as TResult,
    loading: typeof initialData === 'undefined',
    error: false
  })

  function refetch() {
    setTick(t => t + 1)
  }

  // Invalidation
  const resourceId = query.resource || '*'
  useEffect(() => {
    function handler(pattern: string) {
      if (matchResource(pattern, resourceId)) {
        refetch()
      }
    }

    app.events.on('refetch', handler)
    return () => app.events.off('refetch', handler)
  }, [app, resourceId])

  // Polling
  const { pollInterval, pollCache = false } = query
  useEffect(() => {
    if (typeof pollInterval !== 'number' || pollInterval <= 0) {
      return
    }

    const intervalId = setInterval(async () => {
      try {
        const data = await app.apiClient.query(query, {
          allowProgress: false,
          lookupCache: pollCache
        })

        if (data !== state.data || state.loading || state.error) {
          setState({
            data,
            loading: false,
            error: false
          })
        }
      } catch {
        setState({
          data: (undefined as any) as TResult,
          loading: false,
          error: true
        })
      }
    }, pollInterval)

    return () => clearInterval(intervalId)
  }, [pollInterval, pollCache])

  // Fetching
  useDeepCompareEffect(() => {
    async function fetch() {
      try {
        const data = await app.apiClient.query(query, {
          allowProgress: tick === 0,
          lookupCache: true
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
  }, [tick, query.params || noParams])

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    refetch
  }
}

type ActionInvoker<TParams, TResult> =
  TParams extends void
  ? () => Promise<TResult>
  : (params: TParams) => Promise<TResult>

export function useAction
  <TParams, TResult>(action: Action<TParams, TResult>):
  ActionInvoker<TParams, TResult> {
  const app = useApp<App>()
  function invoke(params: TParams): Promise<TResult> {
    return app.apiClient.action(action, params)
  }

  return invoke as ActionInvoker<TParams, TResult>
}
