import { CustomError } from "./CustomError";

/**
 * Minimal structural shape of an express-validator issue.
 * Typed locally (instead of importing `ValidationError`) so this package
 * builds and works against both express-validator v6 (`param`) and v7
 * (`path`) type definitions — services pin different major versions.
 */
export interface ValidationIssue {
  msg: string;
  param?: string;
  path?: string;
  value?: unknown;
}

export class RequestValidationError extends CustomError {
  statusCode = 400;

  constructor(private errors: ValidationIssue[]) {
    super("request validation error");
  }

  serializeErrors() {
    return this.errors.map((err) => {
      return {
        message: err.msg,
        field: err.param,
      };
    });
  }
}
