const COMMON_PASSWORDS = new Set([
  "password1",
  "12345678910",
  "qwertyuiop",
  "letmein123",
  "iloveyou12",
]);

export function validatePassword(password: string): { valid: boolean; reason?: string } {
  if (password.length < 10) {
    return { valid: false, reason: "Password must be at least 10 characters long." };
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { valid: false, reason: "This password is too common. Please choose a different one." };
  }
  return { valid: true };
}
