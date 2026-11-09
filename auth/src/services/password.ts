import argon2 from 'argon2';

export default class Password {
  static async toHash(password: string) {
    return await argon2.hash(password, {
      // Memory cost in KB (64 MB default)
      memoryCost: 65536,
      // Time cost (iterations)
      timeCost: 3,
      // Parallelism (number of threads)
      parallelism: 1,
      // Hash length in bytes
      hashLength: 32
    });
  }

  static async compare(storedPassword: string, suppliedPassword: string) {
    return await argon2.verify(storedPassword, suppliedPassword);
  }
}
