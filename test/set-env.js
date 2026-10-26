// Runs before test files are loaded, so AppModule's env validation sees it.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === '') {
  process.env.JWT_SECRET = 'x'.repeat(32);
}
