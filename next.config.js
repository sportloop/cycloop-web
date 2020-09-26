const withCSS = require("./config/next-css");
const withOffline = require("next-offline");
const withPlugins = require("next-compose-plugins");
const optimizedImages = require("next-optimized-images");
const bundleAnalyzer = require("@next/bundle-analyzer");

module.exports = withPlugins([
  [
    withCSS,
    {
      webpack(config, { isServer }) {
        const testPattern = /\.(woff|woff2|eot|ttf|otf)$/;

        config.module.rules.push({
          test: testPattern,
          use: [
            {
              loader: require.resolve("url-loader"),
              options: {
                limit: 8192,
                fallback: require.resolve("file-loader"),
                publicPath: `/_next/static/chunks/fonts/`,
                outputPath: `${isServer ? "../" : ""}static/chunks/fonts/`,
                name: "[name]-[hash].[ext]",
              },
            },
          ],
        });

        return config;
      },
    },
  ],
  [
    withOffline,
    {
      target: "serverless",
      transformManifest: (manifest) => ["/"].concat(manifest),
      generateInDevMode: false,
      workboxOpts: {
        swDest: "static/service-worker.js",
        runtimeCaching: [
          {
            urlPattern: /^https?.*/,
            handler: "NetworkFirst",
            options: {
              cacheName: "https-calls",
              networkTimeoutSeconds: 15,
              expiration: {
                maxEntries: 150,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 1 month
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    },
  ],
  [optimizedImages, { optimizeImagesInDev: true }],
  [bundleAnalyzer],
]);
