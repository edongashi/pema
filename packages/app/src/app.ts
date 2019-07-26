// tslint:disable: variable-name
// tslint:disable: forin
// tslint:disable: ban-types

import { JObject, Dictionary } from '@pema/utils'
import {
  AppNode,
  ServiceDependencies,
  ServiceConstructor,
  Extended,
  ServiceEnv,
  Emitter,
  AppEnv,
  AppPlugin,
  AppMixin
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
    state: JObject = {},
    root: AppNodeImpl | null = null) {
    this.__state = state
    if (root) {
      this.__root = root
    } else {
      this.__root = this
      const browser = typeof window !== 'undefined'
      this.__env = {
        browser,
        server: !browser
      }

      this.__volatile = {}
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

  mixin<T extends AppMixin<this>>(mixin: T): this & T {
    for (const key in mixin) {
      if (key in this) {
        continue
      }

      Object.defineProperty(this, key, {
        enumerable: false,
        configurable: true,
        writable: true,
        value: mixin[key]
      })
    }

    return this as this & T
  }

  extend<T extends this>(plugin: (app: this) => T): T
  extend<T extends AppNode = this, TExtended extends T = T>(plugin: AppPlugin): this & TExtended
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

          if ((val as any).dependencies) {
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
            child = new AppNodeImpl(state[key] as JObject, root)
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
export function app(state?: JObject): AppNode {
  return new AppNodeImpl(state)
}

export function withEnv
  <T extends ServiceConstructor>(constructor: T, env: ServiceEnv): [T, ServiceEnv] {
  return [constructor, env]
}
