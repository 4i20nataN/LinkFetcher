export {};

declare global {
  const __APP_VERSION__: string;

  interface Window {
    electron?: {
      invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>;
      on: (channel: string, listener: (...args: unknown[]) => void) => () => void;
      off: (channel: string, listener: (...args: unknown[]) => void) => void;
    };
  }
}
