import { CustomError } from "./CustomError";

export class NotFoundError extends CustomError {
  statusCode = 404;
  public reason: string;

  constructor(customReason?: string) {
    super("route not found");
    this.reason = customReason || "route not found";
  }

  serializeErrors() {
    return [
      {
        message: this.reason,
      },
    ];
  }
}
