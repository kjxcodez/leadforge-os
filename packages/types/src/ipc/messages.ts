export interface IpcRequest<T> {
  channel: string;
  payload: T;
}

export interface IpcResponse<T> {
  success: true;
  data: T;
}

export interface IpcError {
  success: false;
  error: {
    message: string;
    code?: string;
  };
}
