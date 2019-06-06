import { JObject, Dictionary } from '@pema/utils'
import {
  AppNode,
  ServiceDependencies,
  ServiceConstructor,
  Extended,
  ServiceEnv,
  Emitter,
  AppEnv
} from './types'
import eventEmitter from 'event-emitter'
import allOff from 'event-emitter/all-off'

class AppNodeImpl implements AppNode {
  private readonly __root: AppNodeImpl
  private readonly __state: JObject
  private readonly __env?: AppEnv
  private readonly __volatile?: Dictionary
  private readonly __events?: Emitter

  constructor(
    root: AppNodeImpl | null = null,
    state: JObject = {},
    env: AppEnv = {},
    volatile: Dictionary = {}) {
    this.__state = state
    if (root) {
      this.__root = root
    } else {
      this.__root = this
      this.__env = env
      this.__volatile = volatile
      this.__events = eventEmitter()
    }
  }

  get root(): AppNodeImpl {
    return this.__root
  }

  get env(): AppEnv {
    return this.__root.__env as AppEnv
  }

  get volatile(): Dictionary {
    return this.__root.__volatile as Dictionary
  }

  get events(): Emitter {
    return this.__root.__events as Emitter
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

  visit(visitor: ((service: any) => void)): void {
    for (const key in this) {
      if (key.indexOf('__') === 0) {
        continue
      }

      const val = this[key] as any
      if (val instanceof AppNodeImpl) {
        val.visit(visitor)
      } else if (val) {
        if (typeof val.handleEvent === 'function') {
          visitor(val)
        }
      }
    }
  }

  emit(type: string, ...args: any[]) {
    this.events.emit(type, ...args)
  }

  dispatch(method: string, ...args: any[]): void {
    this.visit(node => {
      if (node && typeof node[method] === 'function') {
        node[method](...args)
      }
    })
  }

  dispose() {
    this.root.dispatch('dispose')
    allOff(this.events)
  }

  toJSON(): JObject {
    return this.__serialize()
  }

  private __serialize(context?: any): JObject {
    const result: JObject = {}
    const state = this.__state
    const serializer = this.env.defaultSerializer
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
        if (typeof val.toJSON === 'function') {
          result[key] = val.toJSON(context)
        } else if (serializer) {
          result[key] = serializer(val)
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