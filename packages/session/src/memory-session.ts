import { JValue, JObject } from '@pema/utils'
import { Session } from './types'

export default class MemorySession implements Session {
  private state: JObject

  constructor(state: JValue) {
    this.state = (state || {}) as JObject
  }

  async get(key: string): Promise<JValue> {
    return this.state[key] || {}
  }

  async set(key: string, value: JValue): Promise<void> {
    this.state[key] = value
  }

  async clear(): Promise<void> {
    this.state = {}
  }

  toJSON(): JObject {
    return this.state
  }
}
