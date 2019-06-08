export type JValue = string | number | boolean | JObject | JArray | null

export interface JObject {
  [key: string]: JValue
}

export interface JArray extends Array<JValue> { }

export interface Dictionary<T = any> {
  [key: string]: T
}

export type Options<T, TArg = any> = T | ((arg: TArg) => T)

export type ErrorObject = {
  name?: string
  stack?: string
  message?: string
  code?: string
} & JObject
