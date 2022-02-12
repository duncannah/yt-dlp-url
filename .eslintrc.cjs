module.exports = {
	root: true,
	parser: "@typescript-eslint/parser",
	parserOptions: {
		tsconfigRootDir: __dirname,
		project: ["./tsconfig.json"],
		ecmaVersion: 2020,
		warnOnUnsupportedTypeScriptVersion: false,
	},
	plugins: ["@typescript-eslint"],
	extends: [
		"eslint:recommended",
		"plugin:@typescript-eslint/recommended",
		"plugin:@typescript-eslint/recommended-requiring-type-checking",
		"plugin:node/recommended",
		"prettier",
	],
	rules: {
		"no-process-exit": "off",
		"node/no-missing-import": "off",
		"node/no-unsupported-features/es-syntax": "off",
		"prefer-template": "warn",
	},
};
