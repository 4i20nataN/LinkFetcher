export {};

declare global {
  const __APP_VERSION__: string;

  interface Window {
    electron?: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
    };
  }
}
