import nextJest from "next/jest.js";
import dotEnv from "dotenv";

dotEnv.config({
  path: ".env.development",
});

const createJestConfig = nextJest({
  dir: ".",
});

const jestConfig = createJestConfig({
  moduleDirectories: ["node_modules", "<rootDir>"],
  testTimeout: 60000,
  testPathIgnorePatterns: ["<rootDir>/tests/smoke/"],
});

export default createJestConfig(jestConfig);
