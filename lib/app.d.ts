import { JObject, AppNode, ServiceConstructor, ServiceEnv } from './types';
export declare function app(): AppNode;
export declare function app(state: JObject): AppNode;
export declare function withEnv<T extends ServiceConstructor>(constructor: T, env: ServiceEnv): [T, ServiceEnv];
