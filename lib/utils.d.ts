import { AppNode, Dictionary } from "./types";
export declare function getProps(app: AppNode, props?: Function | Dictionary, clone?: boolean): Dictionary;
export declare function warning(condition: any, message: string): void;
export declare function invariant(condition: any, message?: string): void;
