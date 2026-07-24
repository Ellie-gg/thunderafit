/* eslint-disable @typescript-eslint/no-require-imports */
const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

const customJestConfig = {
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/", "<rootDir>/e2e/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
};

module.exports = async () => {
  const config = await createJestConfig(customJestConfig)();
  // next-intl/use-intl publicam só ESM — o transformIgnorePatterns gerado
  // pelo next/jest ignora tudo em node_modules exceto geist/next internals,
  // então sem adicioná-los aqui o Jest tenta rodar o `export` deles como
  // CommonJS puro e quebra no parse. Substitui (não concatena): um array com
  // mais de um padrão vira "ignora se QUALQUER um bater", e o padrão
  // original já bate sozinho pra esses pacotes.
  config.transformIgnorePatterns = [
    "/node_modules/(?!.pnpm)(?!(geist|next-intl|use-intl|@formatjs|intl-messageformat|tslib|next/dist/client|next/dist/shared/lib|next/src/client|next/src/shared/lib)/)",
  ];
  return config;
};
