export declare type JValue = string | number | boolean | JObject | JArray | null;
export interface JObject {
    [key: string]: JValue;
}
export interface JArray extends Array<JValue> {
}
export interface Dictionary {
    [key: string]: any;
}
export interface ServiceEnvFactory {
    (app: any): Dictionary;
}
export declare type ServiceEnv = Dictionary | ServiceEnvFactory;
export interface ServiceConstructor {
    new (state: JValue, app: any, env: Dictionary): any;
}
export interface ServiceDependencies {
    readonly [key: string]: [ServiceConstructor, ServiceEnv] | ServiceConstructor | ServiceDependencies;
}
export declare type Instanced<T extends ServiceDependencies> = {
    readonly [Key in keyof T]: T[Key] extends [ServiceConstructor, ServiceEnv] ? InstanceType<T[Key][0]> : T[Key] extends ServiceConstructor ? InstanceType<T[Key]> : T[Key] extends ServiceDependencies ? Instanced<T[Key]> : never;
};
export declare type Extended<T, U extends ServiceDependencies> = T & Instanced<U>;
export declare type EmitterMethod = (type: string, listener: EventListener) => void;
export declare type EventListener = (...args: any[]) => void;
export interface Emitter {
    emit(type: string, ...args: any[]): void;
    off: EmitterMethod;
    on: EmitterMethod;
    once: EmitterMethod;
}
export interface AppNode {
    readonly root: AppNode;
    readonly env: Dictionary;
    readonly volatile: Dictionary;
    readonly events: Emitter;
    extend<T extends this>(plugin: (app: this) => T): T;
    extend<T extends ServiceDependencies>(services: T): Extended<this, T>;
}
export interface DependencyGraph {
    readonly dependencies: ServiceDependencies;
}
export declare type AppExtension = DependencyGraph | ServiceDependencies | Dictionary;
export declare type Services<T extends AppExtension> = T extends DependencyGraph ? Instanced<T["dependencies"]> : T extends ServiceDependencies ? Instanced<T> : T extends Dictionary ? T : never;
