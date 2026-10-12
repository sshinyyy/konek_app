const tokenPattern = /^[A-Za-z0-9_-]{32,128}$/;

export function isVerificationToken(value: string): boolean {
  return tokenPattern.test(value);
}
