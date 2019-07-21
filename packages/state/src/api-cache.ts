import { AppNode } from '@pema/app'
import { Dictionary } from '@pema/utils'
import { Query, Action } from './types'

interface App extends AppNode {
  progress?: {
    start(): void
    done(): void
  }
}

interface CacheItem {
  expires: number | false
  value: any
}

function normalize(path: string) {
  const parts = path.split('/', 2)
  if (parts.length < 2) {
    parts.push('*')
  }

  return parts
}

function asKey(id: string) {
  return id === '*' ? '__ROOT__' : id
}

export class ApiCache {
  private readonly app: App
  private cache: Dictionary<Map<string, CacheItem>>

  constructor(todo: any, app: App) {
    this.app = app
    this.cache = {}
  }

  invalidate(resources: string[] | string) {
    if (!resources) {
      return
    }

    const { app } = this
    if (resources === '*') {
      this.cache = {}
      app.emit('refetch', '*')
      return
    }

    if (typeof resources === 'string') {
      resources = [resources]
    }

    const paths = resources.map(normalize)
    for (const [type, id] of paths) {
      const map = this.cache[type]
      if (map) {
        if (id === '*') {
          map.clear()
        } else {
          map.delete(id)
        }
      }
    }

    for (const [type, id] of paths) {
      app.emit('refetch', type + '/' + id)
    }
  }

  lookup<TResult>(query: Query<TResult>): TResult | undefined {
    if (!query.cache || !query.resource) {
      return undefined
    }

    const [type, id] = normalize(query.resource)
    const map = this.cache[type]
    if (!map) {
      return undefined
    }

    const key = asKey(id)
    const item = map.get(key)
    if (item) {
      if (item.expires && Date.now() >= item.expires) {
        map.delete(key)
        return undefined
      }

      return item.value
    } else {
      return undefined
    }
  }

  async query<TResult>(query: Query<TResult>, lookup = true): Promise<TResult> {
    let result = lookup ? this.lookup(query) : undefined
    if (typeof result !== 'undefined') {
      return result
    }

    const progress = query.progress ? this.app.progress : null
    if (progress) {
      progress.start()
    }

    try {
      result = await query.fetch(this.app)
      if (typeof result === 'undefined') {
        result = (null as any) as TResult
      }

      if (query.cache && query.resource) {
        const [type, id] = normalize(query.resource)
        let map = this.cache[type]
        if (!map) {
          map = new Map<string, CacheItem>()
          this.cache[type] = map
        }

        const key = asKey(id)
        map.set(key, {
          value: result,
          expires: query.cache === true
            ? false
            : Date.now() + query.cache * 1000
        })
      }

      return result
    } finally {
      if (progress) {
        progress.done()
      }
    }
  }

  async action<TResult>(action: Action<TResult>): Promise<TResult> {
    const progress = action.progress ? this.app.progress : null
    if (progress) {
      progress.start()
    }

    try {
      const result = await action.perform(this.app)
      if (action.invalidates) {
        this.invalidate(action.invalidates)
      }

      return result
    } finally {
      if (progress) {
        progress.done()
      }
    }
  }
}
