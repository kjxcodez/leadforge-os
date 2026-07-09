declare module 'electron-next' {
  export const electronApp: {
    whenReady(): Promise<void>;
  };
  export const is: {
    dev: boolean;
    production: boolean;
    mac: boolean;
    windows: boolean;
    linux: boolean;
  };
}
