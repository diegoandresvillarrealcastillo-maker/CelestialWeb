import argon2, { type HashOptions } from 'argon2';

const options: HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

let dummyHashPromise: Promise<string> | undefined;

export const hashPassword = (password: string) => argon2.hash(password, options);

export async function verifyPassword(hash: string | undefined, password: string): Promise<boolean> {
  dummyHashPromise ??= hashPassword('not-a-real-password-4f79c8cda2');
  try {
    return await argon2.verify(hash ?? await dummyHashPromise, password);
  } catch {
    return false;
  }
}
