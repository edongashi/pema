import {
  JValue,
  JObject,
  AppNode,
  Dictionary,
  ServiceDependencies,
  ServiceConstructor,
  Extended,
  ServiceEnv
} from './types'
import { toJS, runInAction } from 'mobx'

class AppNodeImpl implements AppNode {
  private readonly __root: AppNodeImpl
  private readonly __state: JObject
  private readonly __env: Dictionary
  private readonly __volatile: Dictionary

  constructor(
    root: AppNodeImpl | null = null,
    state: JObject = {},
    env: Dictionary = {},
    volatile: Dictionary = {}) {
    this.__root = root || this
    this.__state = state
    this.__env = env
    this.__volatile = volatile
  }

  get root(): AppNodeImpl {
    return this.__root
  }

  get env(): Dictionary {
    return this.__root.__env
  }

  get volatile(): Dictionary {
    return this.__root.__volatile
  }

  public toJSON(): JObject {
    return this.__serialize()
  }

  extend<T extends this>(plugin: (app: this) => T): T
  extend<T extends ServiceDependencies>(services: T): Extended<this, T>
  extend(services: ServiceDependencies | Function): any {
    if (typeof services === 'object') {
      const node = this as Dictionary
      const root = node.__root as AppNodeImpl
      const state = node.__state as JObject
      for (const key in services) {
        let val = services[key]
        let env = {}
        if (Array.isArray(val)) {
          const arr = val
          val = arr[0]
          env = arr[1] || {}
        }

        if (typeof val === 'function') {
          if (key in node) {
            continue
          }

          if (typeof env === 'function') {
            env = env(root)
          }

          if (typeof (val as any).dependencies === 'object') {
            root.extend((val as any).dependencies)
          }

          const instance = new (val as ServiceConstructor)(state[key] || {}, root, env)

          if (instance && typeof instance === 'object') {
            Object.defineProperty(instance, '$app', {
              enumerable: false,
              configurable: true,
              writable: true,
              value: root
            })
          }

          node[key] = instance
          state[key] = null
        } else if (val && typeof val === 'object') {
          let child = node[key] as AppNodeImpl
          if (!child) {
            child = new AppNodeImpl(root, state[key] as JObject)
            state[key] = null
            node[key] = child
          }

          child.extend(val)
        }
      }

      return this
    } else if (typeof services === 'function') {
      return services(this) || this
    } else {
      return this
    }
  }

  dispatch(event: Dictionary): void {
    runInAction(() => this.__dispatch(event))
  }

  private __dispatch(action: Dictionary): void {
    for (const key in this) {
      if (key.indexOf('__') === 0) {
        continue
      }

      const val = this[key] as any
      if (val instanceof AppNodeImpl) {
        val.__dispatch(action)
      } else if (val) {
        if (typeof val.handleEvent === 'function') {
          val.handleEvent(action)
        }
      }
    }
  }

  private __serialize(context?: any): JObject {
    const result: JObject = {}
    const state = this.__state
    for (const key in state) {
      const val = state[key]
      if (val) {
        result[key] = val
      }
    }

    for (const key in this) {
      if (key.indexOf('__') === 0) {
        continue
      }

      const val = this[key] as any
      if (val instanceof AppNodeImpl) {
        result[key] = val.__serialize(context)
      } else if (val) {
        if (typeof val.serialize === 'function') {
          result[key] = val.serialize(context)
        } else {
          result[key] = toJS(val) as JValue
        }
      }
    }

    return result
  }
}

export function app(): AppNode
export function app(state: JObject): AppNode
export function app(state?: JObject): AppNode {
  return new AppNodeImpl(null, state)
}

export function withEnv
  <T extends ServiceConstructor>(constructor: T, env: ServiceEnv): [T, ServiceEnv] {
  return [constructor, env]
}
