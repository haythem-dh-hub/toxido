export type ApiSuccess<T> = { data: T; error?: never };
export type ApiFailure = { data?: never; error: { code: string; message: string } };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
