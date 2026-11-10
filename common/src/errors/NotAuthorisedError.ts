import { CustomError } from "./CustomError";

export class NotAuthorisedError extends CustomError {
  statusCode = 401;

  constructor() {
    super("Not Authorised");
  }

  serializeErrors() {
    return [
      {
        message: "Not Authorised",
      },
    ];
  }
}
