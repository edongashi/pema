import { JValue } from '@pema/utils'
import { Session } from './types'

// todo

export default class CookieSession implements Session {
  async get(key: string): Promise<JValue> {
    return null
  }

  async set(key: string, value: JValue): Promise<void> {
  }

  async remove(key: string): Promise<void> {
  }
}
