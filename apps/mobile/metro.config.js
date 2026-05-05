const { getDefaultConfig } = require("expo/metro-config");
const fs = require("fs");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const reactNativeRoot = path.dirname(
  require.resolve("react-native/package.json"),
);
const { resolve: metroResolve } = require(
  require.resolve("metro-resolver", { paths: [reactNativeRoot] }),
);

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

const babelRuntimeRoot = path.resolve(projectRoot, "node_modules/@babel/runtime");
if (fs.existsSync(babelRuntimeRoot)) {
  config.resolver.extraNodeModules = {
    ...config.resolver.extraNodeModules,
    "@babel/runtime": babelRuntimeRoot,
  };
}

/**
 * Workspace TS uses NodeNext-style imports (`./Foo.js`) while sources are `.ts`/`.tsx`.
 * Metro resolves those literally — map missing `.js` to existing TypeScript sources.
 */
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    context.originModulePath &&
    moduleName.startsWith(".") &&
    moduleName.endsWith(".js")
  ) {
    const originDir = path.dirname(context.originModulePath);
    const explicitJs = path.normalize(path.join(originDir, moduleName));
    if (!fs.existsSync(explicitJs)) {
      const base = moduleName.slice(0, -3);
      for (const ext of [".tsx", ".ts", ".jsx"]) {
        const candidate = path.normalize(path.join(originDir, base + ext));
        if (fs.existsSync(candidate)) {
          return { type: "sourceFile", filePath: candidate };
        }
      }
    }
  }

  return metroResolve(
    {
      ...context,
      resolveRequest: metroResolve,
    },
    moduleName,
    platform,
  );
};

module.exports = config;
