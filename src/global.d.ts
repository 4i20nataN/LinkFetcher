export {};

declare global {
  const __APP_VERSION__: string;

  interface Window {
    electron?: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      on: (channel: string, listener: (...args: unknown[]) => void) => () => void;
      off: (channel: string, listener: (...args: unknown[]) => void) => void;
    };
  }
}
