import { customAlphabet } from "nanoid";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const nano = customAlphabet(alphabet, 16);
const shortCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);
const token = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 32);

export const newId = (prefix?: string) => (prefix ? `${prefix}_${nano()}` : nano());
export const newReferralCode = () => shortCode();
export const newSecretToken = () => token();
