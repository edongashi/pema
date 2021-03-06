import {
  ActionParams,
  DelayableAction,
  AnyAction,
  Delayed,
  FallbackView,
  DelayedResult,
  Computed
} from './types'
import { invariant, Dictionary } from '@pema/utils'
import { error, allow } from './actions'

export default async function resolveActions(
  callContext: any,
  arg: ActionParams,
  actions:
    | void
    | DelayedResult<void>
    | Computed<void>
    | DelayableAction<AnyAction>
    | Array<DelayedResult<void> | Computed<void> | DelayableAction<AnyAction>>,
  setFallbackView: (view: FallbackView) => void,
  fallbackComputed: boolean | undefined): Promise<AnyAction> {
  if (!fallbackComputed) {
    fallbackComputed = undefined
  }

  if (!actions) {
    return allow()
  } else if (!Array.isArray(actions)) {
    actions = [actions]
  }

  let state: Dictionary = {}
  async function resolveDelayed<T>(value: Delayed<T>, fallback: FallbackView): Promise<T> {
    const v = value as any
    if (!v) {
      return v
    }

    if (typeof v.then === 'function') {
      if (!v.resolved && typeof fallback !== 'undefined') {
        setFallbackView(fallback)
      }

      return await v
    }

    const promise = v.call(callContext, arg, state)
    if (promise && typeof promise.then === 'function') {
      if (!promise.resolved && typeof fallback !== 'undefined') {
        setFallbackView(fallback)
      }

      return await promise
    } else {
      return promise
    }
  }

  for (let i = 0; i < actions.length; i++) {
    let action = actions[i]
    if (!action) {
      continue
    }

    if (typeof action === 'object' && action.type === 'lazy') {
      try {
        const promise = action.value()
        if (!(promise as any).resolved && typeof action.fallback !== 'undefined') {
          setFallbackView(action.fallback)
        }

        action = await promise
      } catch (e) {
        return error(500, e)
      }
    }

    if (typeof action === 'function') {
      try {
        const result = await resolveDelayed(action as Computed<AnyAction | void>, fallbackComputed)
        if (!result) {
          continue
        }

        action = result
      } catch (e) {
        return error(500, e)
      }
    }

    let resolvedAction: AnyAction | void
    if (action.type === 'delay') {
      try {
        resolvedAction = await resolveDelayed<AnyAction | void>(action.value, action.fallback)
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
