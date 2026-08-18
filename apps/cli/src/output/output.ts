export interface Output {
  success(message: string): void;
  warning(message: string): void;
  error(message: string): void;
  info(message: string): void;
  debug(message: string): void;
}
