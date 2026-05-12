import { EventEmitter, on } from "node:events";

export class TypedEventEmitter<TEvents> extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  emit<K extends keyof TEvents & string>(
    event: K,
    payload: TEvents[K],
  ): boolean {
    return super.emit(event, payload);
  }

  on<K extends keyof TEvents & string>(
    event: K,
    listener: (payload: TEvents[K]) => void,
  ): this {
    return super.on(event, listener);
  }

  off<K extends keyof TEvents & string>(
    event: K,
    listener: (payload: TEvents[K]) => void,
  ): this {
    return super.off(event, listener);
  }

  async *toIterable<K extends keyof TEvents & string>(
    event: K,
    opts?: { signal?: AbortSignal },
  ): AsyncIterable<TEvents[K]> {
    for await (const [payload] of on(this, event, opts)) {
      yield payload as TEvents[K];
    }
  }

  // Keyed dispatch — emits on a sub-channel (`${event}:${key}`) so listeners
  // that only care about one key (e.g. a single taskRunId) don't pay the cost
  // of receiving and filtering every other key's events. Critical for the
  // Command Center, where N concurrent subscriptions would otherwise turn each
  // emit into N filtered wake-ups.
  emitFor<K extends keyof TEvents & string>(
    event: K,
    key: string,
    payload: TEvents[K],
  ): boolean {
    return super.emit(`${event}:${key}`, payload);
  }

  async *toIterableFor<K extends keyof TEvents & string>(
    event: K,
    key: string,
    opts?: { signal?: AbortSignal },
  ): AsyncIterable<TEvents[K]> {
    for await (const [payload] of on(this, `${event}:${key}`, opts)) {
      yield payload as TEvents[K];
    }
  }
}
