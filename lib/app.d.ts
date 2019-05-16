import { JValue, JObject } from "./json";
export interface Dictionary {
    [key: string]: any;
}
export interface ServiceEnvFactory {
    (app: AppNode): Dictionary;
}
export declare type ServiceEnv = Dictionary | ServiceEnvFactory;
export interface ServiceConstructor {
    new (state: JValue, app: AppNode, env: Dictionary): any;
}
export interface ServiceDependencies {
    readonly [key: string]: [ServiceConstructor, ServiceEnv] | ServiceConstructor | ServiceDependencies;
}
export declare type Instanced<T extends ServiceDependencies> = {
    readonly [Key in keyof T]: T[Key] extends [ServiceConstructor, ServiceEnv] ? InstanceType<T[Key][0]> : T[Key] extends ServiceConstructor ? InstanceType<T[Key]> : T[Key] extends ServiceDependencies ? Instanced<T[Key]> : never;
};
export declare type Extended<T, U extends ServiceDependencies> = T & Instanced<U>;
export interface DependencyGraph {
    readonly dependencies: ServiceDependencies;
}
export declare type Services = DependencyGraph | ServiceDependencies | Dictionary;
export declare type AppServices<T extends Services> = T extends DependencyGraph ? AppNode & Instanced<T["dependencies"]> : T extends ServiceDependencies ? AppNode & Instanced<T> : T extends Dictionary ? AppNode & T : never;
export declare type AppEnv<T extends Dictionary> = AppNode & {
    readonly env: T;
};
export declare type App<TServices extends Services = {}, TEnv extends Dictionary = {}> = AppServices<TServices> & AppEnv<TEnv>;
export interface AppNode {
    readonly root: AppNode;
    readonly env: Dictionary;
    readonly volatile: Dictionary;
    extend<T extends this>(plugin: (app: this) => T): T;
    extend<T extends ServiceDependencies>(services: T): Extended<this, T>;
}
export declare function app(): AppNode;
export declare function app(state: JObject): AppNode;
export declare function withEnv<T extends ServiceConstructor>(constructor: T, env: ServiceEnv): Readonly<[T, ServiceEnv]>;
