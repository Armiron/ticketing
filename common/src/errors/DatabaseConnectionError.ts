import { CustomError } from "./CustomError";

export class DatabaseConnectionError extends CustomError {
  statusCode = 500;
  reason = "cannot connect to database";

  constructor() {
    super("cannot connect to database");
  }

  serializeErrors() {
    return [
      {
        message: this.reason,
      },
    ];
  }
}
