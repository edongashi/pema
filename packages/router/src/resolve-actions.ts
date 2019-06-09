import {
  ActionParams,
  DelayableAction,
  AnyAction,
  Delayed,
  FallbackView
} from './types'
import { invariant, Dictionary } from '@pema/utils'
import { error, allow, delay } from './actions'

export default async function resolveActions(
  arg: ActionParams,
  actions: DelayableAction<AnyAction> | DelayableAction<AnyAction>[],
  setFallbackView: (view: FallbackView) => void): Promise<AnyAction> {
  if (!actions) {
    actions = []
  } else if (!Array.isArray(actions)) {
    actions = [actions]
  }

  let state: Dictionary = {}
  async function resolveDelayed<T>(value: Delayed<T>, fallback: FallbackView | undefined): Promise<T> {
    const v = value as any
    if (!v) {
      return v
    }

    if (typeof v.then === 'function') {
      if (typeof fallback !== 'undefined') {
        setFallbackView(fallback)
      }

      return await v
    }

    const promise = v(arg, state)
    if (promise && typeof promise.then === 'function') {
      if (typeof fallback !== 'undefined') {
        setFallbackView(fallback)
      }

      return await promise
    } else {
      return promise
    }
  }

  for (let i = 0; i < actions.length; i++) {
    let action = actions[i]
    if (typeof action === 'object' && action.type === 'lazy') {
      if (typeof action.fallback !== 'undefined') {
        setFallbackView(action.fallback)
      }

      try {
        action = await action.value()
      } catch (e) {
        return error(500, e)
      }
    }

    let resolvedAction: AnyAction
    if (typeof action === 'function') {
      action = delay(action)
    }

    if (action.type === 'delay') {
      try {
        resolvedAction = await resolveDelayed(action.value, action.fallback)
      } catch (e) {
        return error(500, e)
      }
    } else {
      invariant((action as any).type !== 'lazy', 'Cannot resolve a delayed lazy result.')
      resolvedAction = action
    }

    if (resolvedAction && resolvedAction.type !== 'allow') {
      return resolvedAction
    }
  }

  return allow()
}
