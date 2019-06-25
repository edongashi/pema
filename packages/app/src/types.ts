import { Request, Response } from 'express'
import { Dictionary, JValue, JObject, Options } from '@pema/utils'

export interface ServiceEnvFactory {
  (app: any): Dictionary
}

export type ServiceEnv = Dictionary | ServiceEnvFactory

export interface ServiceConstructor {
  new(state: any, app: any, env: any): any
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

export type EmitterMethod = (type: string, listener: EventListener) => void

export type EventListener = (...args: any[]) => void

export interface Emitter {
  emit(type: string, ...args: any[]): void
  off: EmitterMethod
  on: EmitterMethod
  once: EmitterMethod
}

export interface AppEnv extends Dictionary {
  defaultSerializer?: (component: any) => JValue
  req?: Request
  res?: Response
  server: boolean
  browser: boolean
}

export interface AppPlugin<TApp extends AppNode = AppNode, TAppExtended extends TApp = TApp> {
  (app: TApp, env: any): TAppExtended | void
}

export interface AppNode {
  readonly root: AppNode
  readonly env: AppEnv
  readonly volatile: Dictionary
  readonly events: Emitter
  extend<T extends this>(plugin: (app: this) => T): T
  extend<T extends AppNode = this, TExtended extends T = T>(plugin: AppPlugin<T, TExtended>): this & TExtended
  extend<T extends ServiceDependencies>(services: T): Extended<this, T>
  visit(visitor: ((service: any) => void)): void
  emit(type: string, ...args: any[]): void
  dispatch(method: string, ...args: any[]): void
  dispose(): void
  toJSON(): JObject
}

export interface DependencyGraph {
  readonly dependencies: ServiceDependencies | AppPlugin
}

type ResolvePlugin<T extends AppPlugin> = ReturnType<T> extends void ? {} : ReturnType<T>

type ResolveDependencies<T extends ServiceDependencies | AppPlugin> =
  T extends AppPlugin ? ResolvePlugin<T> :
  T extends ServiceDependencies ? Instanced<T> :
  never

export type AppExtension =
  | DependencyGraph
  | ServiceDependencies
  | Dictionary
  | AppPlugin

export type Services<T extends AppExtension> =
  T extends DependencyGraph ? ResolveDependencies<T['dependencies']> :
  T extends ServiceDependencies ? Instanced<T> :
  T extends Dictionary ? T :
  T extends AppPlugin ? ResolvePlugin<T> :
  {}

export type AppOptions<TOptions, TApp extends AppNode =
  AppNode> = Options<TOptions, TApp>
