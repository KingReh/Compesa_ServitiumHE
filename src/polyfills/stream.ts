// Polyfill stub for Node 'stream' module in Vite browser environment
export class Readable {}
export class Writable {}
export class Transform {}
export class Duplex {}
export class Stream {}

const streamStub = {
  Readable,
  Writable,
  Transform,
  Duplex,
  Stream,
};

export default streamStub;
