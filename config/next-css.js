const MiniCssExtractPlugin = require("mini-css-extract-plugin");

const fileExtensions = new Set();
let extractCssInitialized = false;

const cssLoaderConfig = (
  config,
  {
    extensions = [],
    cssModules = false,
    cssLoaderOptions = {},
    dev,
    isServer,
    loaders = [],
  }
) => {
  // We have to keep a list of extensions for the splitchunk config
  for (const extension of extensions) {
    fileExtensions.add(extension);
  }

  if (!isServer) {
    config.optimization.splitChunks.cacheGroups.styles = {
      name: "styles",
      test: new RegExp(`\\.+(${[...fileExtensions].join("|")})$`),
      chunks: "all",
      enforce: true,
    };
  }

  if (!isServer && !extractCssInitialized) {
    config.plugins.push(
      new MiniCssExtractPlugin({
        // Options similar to the same options in webpackOptions.output
        // both options are optional
        filename: dev
          ? "static/css/[name].css"
          : "static/css/[name].[contenthash:8].css",
        chunkFilename: dev
          ? "static/css/[name].chunk.css"
          : "static/css/[name].[contenthash:8].chunk.css",
      })
    );
    extractCssInitialized = true;
  }

  const cssLoader = {
    loader: "css-loader",
    options: Object.assign(
      {},
      {
        modules: cssModules,
        sourceMap: dev,
        importLoaders: loaders.length,
        onlyLocals: isServer,
      },
      cssLoaderOptions
    ),
  };

  // When on the server and using css modules we transpile the css
  if (isServer && cssLoader.options.modules) {
    return [cssLoader, ...loaders].filter(Boolean);
  }

  return [
    !isServer && dev && "extracted-loader",
    !isServer && MiniCssExtractPlugin.loader,
    cssLoader,
    ...loaders,
  ].filter(Boolean);
};

module.exports = (nextConfig = {}) => {
  return Object.assign({}, nextConfig, {
    webpack(config, options) {
      if (!options.defaultLoaders) {
        throw new Error(
          "This plugin is not compatible with Next.js versions below 5.0.0 https://err.sh/next-plugins/upgrade"
        );
      }

      const { dev, isServer } = options;
      const { cssModules, cssLoaderOptions } = nextConfig;

      options.defaultLoaders.css = cssLoaderConfig(config, {
        extensions: ["css"],
        cssModules,
        cssLoaderOptions,
        dev,
        isServer,
      });

      const linariaLoader = {
        loader: "linaria/loader",
        options: {
          sourceMap: process.env.NODE_ENV !== "production",
        },
      };

      config.module.rules.push({ test: /\.(t)?sx$/, use: linariaLoader });

      config.module.rules.push({
        test: /\.css$/,
        use: options.defaultLoaders.css,
      });

      if (typeof nextConfig.webpack === "function") {
        return nextConfig.webpack(config, options);
      }

      return config;
    },
  });
};
