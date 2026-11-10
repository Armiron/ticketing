export abstract class CustomError extends Error {
  abstract statusCode: number;

  constructor(message: string) {
    super(message);
    // Restore the correct prototype chain when extending Error.
    Object.setPrototypeOf(this, new.target.prototype);

    console.log(
      `${this.constructor.name} encountered due to ${this.message}`
    );
  }

  abstract serializeErrors(): {
    message: string;
    field?: string;
  }[];
}
