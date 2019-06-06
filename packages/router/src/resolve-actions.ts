import {
  ActionParams,
  DelayableAction,
  AnyAction,
  View,
  Delayed
} from './types'
import { invariant } from '@pema/utils'
import { error, allow } from './actions'

export default async function resolveActions(
  arg: ActionParams,
  actions: DelayableAction<AnyAction> | DelayableAction<AnyAction>[],
  setFallbackView: (view: View) => void): Promise<AnyAction> {
  if (!Array.isArray(actions)) {
    actions = [actions]
  }

  async function resolveDelayed<T>(value: Delayed<T>, fallback: View | undefined): Promise<T> {
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

    const promise = v(arg)
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
    if (action.type === 'lazy') {
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
