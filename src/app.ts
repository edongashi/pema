import { JValue, JObject } from "./json";
import { toJS, action } from "mobx";

export interface Dictionary {
  [key: string]: any;
}

export interface ServiceEnvFactory {
  (app: AppNode): Dictionary
}

export type ServiceEnv = Dictionary | ServiceEnvFactory

export interface ServiceConstructor {
  new(state: JValue, app: AppNode, env: Dictionary): any
}

export interface ServiceDependencies {
  readonly [key: string]: [ServiceConstructor, ServiceEnv] | ServiceConstructor | ServiceDependencies
}

export type Instanced<T extends ServiceDependencies> = {
  readonly [Key in keyof T]:
  T[Key] extends [ServiceConstructor, ServiceEnv] ? InstanceType<T[Key][0]> :
  T[Key] extends ServiceConstructor ? InstanceType<T[Key]> :
  T[Key] extends ServiceDependencies ? Instanced<T[Key]> :
  never
}

export type Extended<T, U extends ServiceDependencies> = T & Instanced<U>

export interface DependencyGraph {
  readonly dependencies: ServiceDependencies
}

export type Services = DependencyGraph | ServiceDependencies | Dictionary

export type AppServices<T extends Services> =
  T extends DependencyGraph ? AppNode & Instanced<T["dependencies"]> :
  T extends ServiceDependencies ? AppNode & Instanced<T> :
  T extends Dictionary ? AppNode & T :
  never

export type AppEnv<T extends Dictionary>
  = AppNode & { readonly env: T }

export type App<TServices extends Services = {}, TEnv extends Dictionary = {}>
  = AppServices<TServices> & AppEnv<TEnv>

export interface AppNode {
  readonly root: AppNode
  readonly env: Dictionary
  readonly volatile: Dictionary
  extend<T extends this>(plugin: (app: this) => T): T
  extend<T extends ServiceDependencies>(services: T): Extended<this, T>
}

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

          const instance = new (val as ServiceConstructor)(state[key] || {}, root, env)

          Object.defineProperty(instance, '$app', {
            enumerable: false,
            configurable: true,
            writable: true,
            value: root
          })

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

  @action dispatch(event: Dictionary): void {
    this.__dispatch(event)
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
  <T extends ServiceConstructor>(constructor: T, env: ServiceEnv):
  Readonly<[T, ServiceEnv]> {
  return [constructor, env]
}
