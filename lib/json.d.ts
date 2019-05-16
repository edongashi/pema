export declare type JValue = string | number | boolean | JObject | JArray | null;
export interface JObject {
    [key: string]: JValue;
}
export interface JArray extends Array<JValue> {
}
