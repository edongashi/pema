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

interface SetFallbackView {
  (view: FallbackView): void
  cancel(): void
}

export default async function resolveActions(
  callContext: any,
  arg: ActionParams,
  actions:
    | void
    | DelayedResult<void>
    | Computed<void>
    | DelayableAction<AnyAction>
    | Array<DelayedResult<void> | Computed<void> | DelayableAction<AnyAction>>,
  setFallbackView: SetFallbackView) {
  if (!actions) {
    return allow()
  } else if (!Array.isArray(actions)) {
    actions = [actions]
  }

  let hasFallback = false

  let state: Dictionary = {}
  async function resolveDelayed<T>(value: Delayed<T>, fallback: FallbackView | undefined): Promise<T> {
    const v = value as any
    if (!v) {
      return v
    }

    if (typeof v.then === 'function') {
      if (typeof fallback !== 'undefined') {
        hasFallback = true
        setFallbackView(fallback)
      }

      return await v
    }

    const promise = v.call(callContext, arg, state)
    if (promise && typeof promise.then === 'function') {
      if (typeof fallback !== 'undefined') {
        hasFallback = true
        setFallbackView(fallback)
      }

      return await promise
    } else {
      return promise
    }
  }

  function cancel() {
    if (hasFallback) {
      setFallbackView.cancel()
    }
  }

  for (let i = 0; i < actions.length; i++) {
    let action = actions[i]
    if (!action) {
      continue
    }

    if (typeof action === 'object' && action.type === 'lazy') {
      if (typeof action.fallback !== 'undefined') {
        setFallbackView(action.fallback)
      }

      try {
        action = await action.value()
      } catch (e) {
        cancel()
        return error(500, e)
      }
    }

    if (typeof action === 'function') {
      try {
        const result = await resolveDelayed(action as Computed<AnyAction | void>, true)
        if (!result) {
          continue
        }

        action = result
      } catch (e) {
        cancel()
        return error(500, e)
      }
    }

    let resolvedAction: AnyAction | void
    if (action.type === 'delay') {
      try {
        resolvedAction = await resolveDelayed<AnyAction | void>(action.value, action.fallback)
      } catch (e) {
        cancel()
        return error(500, e)
      }
    } else {
      invariant((action as any).type !== 'lazy', 'Cannot resolve a delayed lazy result.')
      resolvedAction = action
    }

    if (resolvedAction && resolvedAction.type !== 'allow') {
      cancel()
      return resolvedAction
    }
  }

  cancel()
  return allow()
}
