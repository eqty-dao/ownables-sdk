import TypedDict from "@/interfaces/TypedDict";
import { decode, encode } from "cbor-x";
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

interface HostAbiEnvelope {
  success: boolean;
  payload?: Uint8Array;
  error_code?: string;
  error_message?: string;
}

interface WorkerPayload {
  result: string;
  mem?: { state_dump: StateDump };
}

export default class WorkerRPC {
  private worker!: Worker;
  private readonly ownableId: string;
  private widgetWindow: Window | null = null;
  private _queue: Promise<any> = Promise.resolve();

  constructor(id: string) {
    this.ownableId = id;
  }

  private wrapWorkerError(context: string, err: unknown): Error {
    if (err instanceof Error) return err;

    if (typeof ErrorEvent !== "undefined" && err instanceof ErrorEvent) {
      const parts = [
        context,
        err.message || "worker script error",
        err.filename ? `at ${err.filename}:${err.lineno}:${err.colno}` : "",
      ].filter(Boolean);
      const wrapped = new Error(parts.join(" "));
      (wrapped as any).cause = err;
      return wrapped;
    }

    if (typeof MessageEvent !== "undefined" && err instanceof MessageEvent) {
      const wrapped = new Error(`${context}: worker message deserialization error`);
      (wrapped as any).cause = err;
      return wrapped;
    }

    if (err instanceof Event) {
      const eventLike = err as any;
      const details = [
        eventLike?.message,
        eventLike?.filename
          ? `at ${eventLike.filename}:${eventLike.lineno ?? "?"}:${eventLike.colno ?? "?"}`
          : "",
      ]
        .filter((v) => typeof v === "string" && v.trim() !== "")
        .join(" ");
      const wrapped = new Error(
        `${context}: worker emitted ${err.type} event${details ? ` (${details})` : ""}`
      );
      (wrapped as any).cause = err;
      return wrapped;
    }

    const wrapped = new Error(`${context}: ${String(err)}`);
    (wrapped as any).cause = err;
    return wrapped;
  }

  async initialize(js: string, wasm: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      const blob = new Blob([js], { type: "application/javascript" });
      const blobURL = URL.createObjectURL(blob);
      this.worker = new Worker(blobURL, { type: "module" });
      let settled = false;

      const onMessage = (event: MessageEvent<{ success?: boolean; err?: string }>) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (event.data?.err) {
          const raw = event.data.err;
          if (raw.includes("__wbindgen_placeholder__")) {
            reject(
              new Error(
                "Ownable package is incompatible with this runtime (wasm-bindgen imports detected). Rebuild and re-import the package with Host ABI v1."
              )
            );
            return;
          }
          reject(new Error(`Ownable worker init failed: ${raw}`));
          return;
        }
        if (event.data?.success) {
          resolve();
          return;
        }
        reject(new Error("Ownable worker init failed: invalid init response"));
      };

      const onError = (event: Event) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(this.wrapWorkerError("Ownable worker init failed", event));
      };

      const onMessageError = (event: MessageEvent) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(this.wrapWorkerError("Ownable worker init failed", event));
      };

      const cleanup = () => {
        URL.revokeObjectURL(blobURL);
        this.worker.removeEventListener("message", onMessage);
        this.worker.removeEventListener("error", onError);
        this.worker.removeEventListener("messageerror", onMessageError);
      };

      this.worker.addEventListener("message", onMessage);
      this.worker.addEventListener("error", onError);
      this.worker.addEventListener("messageerror", onMessageError);

      this.worker.postMessage({ type: "init", wasm });
    });
  }

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

  private decodeEnvelope(output: ArrayBuffer | Uint8Array): WorkerPayload {
    const envelope = decode(
      output instanceof Uint8Array ? output : new Uint8Array(output)
    ) as HostAbiEnvelope;

    if (!envelope.success) {
      throw new Error(
        `Ownable ABI call failed: ${envelope.error_code || "UNKNOWN"} ${envelope.error_message || ""}`.trim()
      );
    }

    const payload = envelope.payload ?? new Uint8Array();
    return decode(payload) as WorkerPayload;
  }

  private workerCall(
    type: string,
    request: TypedDict,
    state?: StateDump
  ): Promise<{ response: string; state: StateDump }> {
    const call = () =>
      new Promise<{ response: string; state: StateDump }>((resolve, reject) => {
        if (!this.worker) {
          reject(`Unable to ${type}: not initialized`);
          return;
        }
        let settled = false;

        const onMessage = (
          event: MessageEvent<{ output?: ArrayBuffer | Uint8Array; err?: string }>
        ) => {
          if (settled) return;
          settled = true;
          cleanup();
          if (event.data?.err) {
            reject(new Error(`Ownable ${type} failed: ${event.data.err}`));
            return;
          }

          if (!event.data?.output) {
            reject(new Error(`Ownable ${type} failed: empty worker output`));
            return;
          }

          try {
            const decoded = this.decodeEnvelope(event.data.output);
            const nextState = decoded.mem?.state_dump ?? state;
            resolve({ response: decoded.result, state: nextState || [] });
          } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        };

        const onError = (event: Event) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(
            this.wrapWorkerError(`Ownable ${type} failed`, event)
          );
        };

        const onMessageError = (event: MessageEvent) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(
            this.wrapWorkerError(`Ownable ${type} failed`, event)
          );
        };

        const cleanup = () => {
          this.worker.removeEventListener("message", onMessage);
          this.worker.removeEventListener("error", onError);
          this.worker.removeEventListener("messageerror", onMessageError);
        };

        this.worker.addEventListener("message", onMessage);
        this.worker.addEventListener("error", onError);
        this.worker.addEventListener("messageerror", onMessageError);

        const input = encode(request);
        this.worker.postMessage({ type, input });
      });

    const next = this._queue.then(call, call);
    this._queue = next.catch(() => {});
    return next;
  }

  async instantiate(
    msg: TypedDict,
    info: MessageInfo
  ): Promise<{ attributes: TypedDict<string>; state: StateDump }> {
    const { response, state } = await this.workerCall("instantiate", { msg, info });
    const parsed = JSON.parse(response) as Response;
    return {
      attributes: this.attributesToDict(parsed.attributes),
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
    const { response, state: newState } = await this.workerCall(
      "execute",
      { msg, info, mem: { state_dump: state } },
      state
    );
    return this.toExecuteResult(JSON.parse(response) as Response, newState);
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
    const { response, state: newState } = await this.workerCall(
      "external_event",
      {
        msg: msg.msg,
        info,
        ownable_id: this.ownableId,
        mem: { state_dump: state },
      },
      state
    );
    return this.toExecuteResult(JSON.parse(response) as Response, newState);
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
    return (await this.workerCall("query", { msg, mem: { state_dump: state } }, state)).response;
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
