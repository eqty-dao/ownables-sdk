import TypedDict from "@/interfaces/TypedDict";
import { StateDump } from "./Ownable.service";

interface MessageInfo {
  sender: string;
  funds: Array<{}>;
}

interface Response {
  attributes: Array<{ key: string; value: any }>;
  events?: Array<{ type: string; attributes: Array<{ key: string; value: any }> }>;
  data?: string;
}

interface CosmWasmEvent {
  type: string;
  attributes: TypedDict<string>;
}

/**
 * Manages a dedicated Web Worker per ownable that runs the WASM contract.
 * Replaces the outer iframe + simple-iframe-rpc layer from the previous architecture.
 * The worker is initialized once at app load (initWorker) and reused for both
 * canConsume eligibility checks and full display operations.
 */
export default class WorkerRPC {
  private worker!: Worker;
  private readonly ownableId: string;
  private widgetWindow: Window | null = null;
  private _queue: Promise<any> = Promise.resolve();

  constructor(id: string) {
    this.ownableId = id;
  }

  /**
   * Creates the Worker from a JS blob (worker.js + ownable.js combined),
   * sends the WASM buffer, and waits for the "WASM instantiated" confirmation.
   */
  async initialize(js: string, wasm: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      const blob = new Blob([js], { type: "application/javascript" });
      const blobURL = URL.createObjectURL(blob);
      this.worker = new Worker(blobURL, { type: "module" });

      this.worker.onmessage = (event) => resolve(event.data);
      this.worker.onerror = (err) => reject(err);
      this.worker.onmessageerror = (err) => reject(err);

      const buffer = wasm.buffer;
      this.worker.postMessage(buffer, [buffer]);
    });
  }

  /** Register the widget iframe window so refresh() can push state to it. */
  setWidgetWindow(win: Window | null): void {
    this.widgetWindow = win;
  }

  terminate(): void {
    this.worker?.terminate();
  }

  private attributesToDict(
    attributes: Array<{ key: string; value: any }>
  ): TypedDict<string> {
    return Object.fromEntries(attributes.map((a) => [a.key, a.value]));
  }

  /**
   * Send a message to the worker and await its response.
   * Calls are serialized through a queue so only one message is in-flight
   * at a time — the {once:true} listener pattern requires strict sequencing.
   */
  private workerCall<T extends Response | string>(
    type: string,
    msg: TypedDict,
    info: TypedDict,
    state?: StateDump
  ): Promise<{ response: T; state: StateDump }> {
    const call = () =>
      new Promise<{ response: T; state: StateDump }>((resolve, reject) => {
        if (!this.worker) {
          reject(`Unable to ${type}: not initialized`);
          return;
        }

        this.worker.addEventListener(
          "message",
          (event: MessageEvent<Map<string, any> | { err: any }>) => {
            if ("err" in event.data) {
              reject(
                new Error(`Ownable ${type} failed`, { cause: event.data.err })
              );
              return;
            }

            const result = event.data.get("result");
            const response = JSON.parse(result) as T;
            const nextState: StateDump = event.data.has("mem")
              ? JSON.parse(event.data.get("mem")).state_dump
              : state;

            resolve({ response, state: nextState });
          },
          { once: true }
        );

        this.worker.postMessage({
          type,
          ownable_id: this.ownableId,
          msg,
          info,
          mem: { state_dump: state },
        });
      });

    const next = this._queue.then(call, call);
    this._queue = next.catch(() => {});
    return next;
  }

  async instantiate(
    msg: TypedDict,
    info: MessageInfo
  ): Promise<{ attributes: TypedDict<string>; state: StateDump }> {
    const { response, state } = await this.workerCall<Response>(
      "instantiate",
      msg,
      info as unknown as TypedDict
    );
    return {
      attributes: this.attributesToDict((response as Response).attributes),
      state,
    };
  }

  async execute(
    msg: TypedDict,
    info: MessageInfo,
    state: StateDump
  ): Promise<{
    attributes: TypedDict<string>;
    events: Array<CosmWasmEvent>;
    data: string;
    state: StateDump;
  }> {
    const { response, state: newState } = await this.workerCall<Response>(
      "execute",
      msg,
      info as unknown as TypedDict,
      state
    );
    return this.toExecuteResult(response as Response, newState);
  }

  async externalEvent(
    msg: TypedDict,
    info: TypedDict,
    state: StateDump
  ): Promise<{
    attributes: TypedDict<string>;
    events: Array<CosmWasmEvent>;
    data: string;
    state: StateDump;
  }> {
    const { response, state: newState } = await this.workerCall<Response>(
      "external_event",
      msg,
      { info },
      state
    );
    return this.toExecuteResult(response as Response, newState);
  }

  private toExecuteResult(
    response: Response,
    state: StateDump
  ): {
    attributes: TypedDict<string>;
    events: Array<CosmWasmEvent>;
    data: string;
    state: StateDump;
  } {
    return {
      attributes: this.attributesToDict(response.attributes),
      events: (response.events || []).map((e) => ({
        type: e.type,
        attributes: this.attributesToDict(e.attributes),
      })),
      data: response.data ?? "",
      state,
    };
  }

  async queryRaw(msg: TypedDict, state: StateDump): Promise<string> {
    return (await this.workerCall<string>("query", msg, {}, state))
      .response as string;
  }

  async query(msg: TypedDict, state: StateDump): Promise<any> {
    const resultB64 = await this.queryRaw(msg, state);
    try {
      const bytes = Uint8Array.from(atob(resultB64), (c) => c.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (error) {
      console.error("Failed to decode base64 result:", error);
      throw new Error(
        `Invalid base64 data: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async refresh(state: StateDump): Promise<void> {
    if (!this.widgetWindow) return;
    const widgetState = await this.query({ get_widget_state: {} }, state);
    this.widgetWindow.postMessage(
      { ownable_id: this.ownableId, state: widgetState },
      "*"
    );
  }
}
