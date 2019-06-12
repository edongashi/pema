import { JValue } from '@pema/utils'

export interface Session {
  get(key: string): Promise<JValue>
  set(key: string, value: JValue): Promise<void>
  remove(key: string): Promise<void>
}
