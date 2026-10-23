module.exports = {
  preset: 'jest-expo',
  testMatch: [
    '<rootDir>/src/**/*.{test,spec}.{ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{web,native,ios,android}.{ts,tsx}',
  ],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
};
