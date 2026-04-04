import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    ignores: [
      ".next/**",
      ".playwright-mcp/**",
      "Codeflow_IDE/**",
      "artifacts/**",
      "coverage/**",
      "node_modules/**"
    ]
  },
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off"
    }
  }
];

export default config;
