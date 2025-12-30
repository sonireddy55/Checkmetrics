const path = require("path");

module.exports = {
  mode: "production", // "development" if you want to debug, "production" for speed
  entry: {
    sidebar: "./src/sidebar.tsx", // The entry point for your React UI
    extension: "./src/extension.ts", // The main extension entry point
  },
  output: {
    path: path.resolve(__dirname, "dist"), // Where to spit out the finished file
    filename: "[name].js", // Becomes "sidebar.js" and "extension.js"
    libraryTarget: "commonjs2",
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx", ".css"],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader", "postcss-loader"],
      },
    ],
  },
  externals: {
    vscode: "commonjs vscode", // Important: VS Code modules cannot be webpack'd
  },
  devtool: "nosources-source-map", // Helps with debugging but keeps it clean
};
