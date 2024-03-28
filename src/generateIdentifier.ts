import crypto from "crypto";
export function generateIderntifier() {
  return crypto.randomBytes(2);
}
