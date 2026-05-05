const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          root: [workspaceRoot],
          extensions: [".tsx", ".ts", ".js", ".jsx", ".json"],
          alias: {
            "@kb-rag/shared": path.join(workspaceRoot, "packages/shared/src"),
            "@kb-rag/design-system": path.join(workspaceRoot, "packages/design-system/src"),
            "@kb-rag/app-shared": path.join(workspaceRoot, "packages/app-shared/src"),
          },
        },
      ],
    ],
  };
};
