const ts = require('typescript');
const fs = require('node:fs');

// Run first-party TypeScript with Node's test runner without a second build or new dependencies.
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    fileName: filename,
  });
  module._compile(outputText, filename);
};
