import { useContext, useState, useEffect } from 'react'
import { AppNode } from '@pema/app'
import { invariant } from '@pema/utils'
import get from 'lodash.get'
import AppNodeContext from './context'

export function useApp(): AppNode {
  const app = useContext(AppNodeContext)
  invariant(app, 'No application context found.')
  return app as AppNode
}

export function useValue<T>(key: string): T {
  const app = useApp()
  const [value, setValue] = useState(() => get(app, key) as T)
  useEffect(function () {
    function listen(newValue: T) {
      setValue(newValue)
    }

    if (typeof key === 'string') {
      app.events.on(key, listen)
      return () => app.events.off(key, listen)
    }
  }, [key, app])

  return value
}

export function useEvent(event: string): void {
  const [tick, setTick] = useState(0)
  const app = useApp()
  useEffect(function () {
    function listen() {
      setTick((tick + 1) % 100)
    }

    if (typeof event === 'string') {
      app.events.on(event, listen)
      return () => app.events.off(event, listen)
    }
  }, [event, app])
}
