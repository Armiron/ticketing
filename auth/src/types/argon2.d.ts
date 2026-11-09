// Type shim for the `argon2` package (v0.45+).
// argon2 ships its own types in `argon2.d.cts`, which TypeScript 4.6
// (this project's pinned version) does not support. This declares the
// subset of the modern API used in this project.
declare module 'argon2' {
  export interface Argon2Options {
    type?: number;
    version?: number;
    memoryCost?: number;
    timeCost?: number;
    outputLen?: number;
    secretKey?: Buffer | string;
    parallelism?: number;
    hashLength?: number;
    saltLength?: number;
    encoding?: string;
  }

  export function hash(
    data: string | Buffer,
    options?: Argon2Options
  ): Promise<string>;

  export function verify(
    hash: string,
    data: string | Buffer
  ): Promise<boolean>;

  const argon2: {
    hash: typeof hash;
    verify: typeof verify;
  };
  export default argon2;
}
