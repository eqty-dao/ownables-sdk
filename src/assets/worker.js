let wasm;
let exportsRef;
let memory;

function toU8Array(value) {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new Error("invalid wasm payload: expected ArrayBuffer or TypedArray");
}

function unpackPtrLen(packed) {
  const value = typeof packed === "bigint" ? packed : BigInt(packed);
  const ptr = Number(value & 0xffffffffn);
  const len = Number((value >> 32n) & 0xffffffffn);
  return { ptr, len };
}

function invoke(type, inputBytes) {
  if (!exportsRef || !memory) {
    throw new Error("WASM not initialized");
  }

  const len = inputBytes.length >>> 0;
  const inPtr = exportsRef.ownable_alloc(len);

  if (len > 0) {
    new Uint8Array(memory.buffer, inPtr, len).set(inputBytes);
  }

  let packed;
  try {
    switch (type) {
      case "instantiate":
        packed = exportsRef.ownable_instantiate(inPtr, len);
        break;
      case "execute":
        packed = exportsRef.ownable_execute(inPtr, len);
        break;
      case "query":
        packed = exportsRef.ownable_query(inPtr, len);
        break;
      case "external_event":
        packed = exportsRef.ownable_external_event(inPtr, len);
        break;
      default:
        throw new Error(`unknown message type ${type}`);
    }
  } finally {
    exportsRef.ownable_free(inPtr, len);
  }

  const { ptr: outPtr, len: outLen } = unpackPtrLen(packed);
  const output = outLen > 0
    ? new Uint8Array(new Uint8Array(memory.buffer, outPtr, outLen))
    : new Uint8Array();

  if (outLen > 0) {
    exportsRef.ownable_free(outPtr, outLen);
  }

  return output;
}

addEventListener("message", async (e) => {
  try {
    const { type: messageType } = e.data || {};

    if (messageType === "init") {
      const wasmBytes = toU8Array(e.data.wasm);
      const { instance } = await WebAssembly.instantiate(wasmBytes, {});
      wasm = instance;
      exportsRef = wasm.exports;
      memory = exportsRef.memory;
      self.postMessage({ success: true, msg: "WASM instantiated successfully" });
      return;
    }

    if (!wasm) {
      throw new Error("WASM not initialized");
    }

    const { type, input } = e.data;
    const inBytes = new Uint8Array(input || new ArrayBuffer(0));
    const output = invoke(type, inBytes);
    self.postMessage({ output }, [output.buffer]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({ err: message });
  }
});
