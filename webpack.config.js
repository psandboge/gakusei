const path = require('path');
const webpack = require('webpack');
const { merge } = require('webpack-merge');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');

module.exports = (env = {}, argv = {}) => {
  const production = argv.mode === 'production';
  const serving = Boolean(env.WEBPACK_SERVE);
  return merge(require(production ? './webpack.partial.prod' : './webpack.partial.dev')(serving), {
    entry: { main: './src/main/js/main.js' },
    output: {
      path: path.resolve(__dirname, 'src/main/resources/static/js'),
      publicPath: serving ? '/' : '/js/',
      clean: true
    },
    resolve: {
      // The about page's XML parser still uses these browser equivalents.
      fallback: {
        timers: require.resolve('timers-browserify'),
        stream: require.resolve('stream-browserify')
      }
    },
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          use: { loader: 'babel-loader', options: { plugins: serving ? ['react-refresh/babel'] : [] } }
        },
        {
          test: /\.scss$/,
          use: [
            'style-loader',
            {
              loader: 'css-loader',
              options: { importLoaders: 2, url: { filter: url => !url.startsWith('/') } }
            },
            'postcss-loader',
            {
              loader: 'sass-loader',
              options: {
                implementation: require('sass'),
                sassOptions: { loadPaths: [path.resolve('src/main/resources/static/css')] }
              }
            }
          ]
        }
      ]
    },
    plugins: [
      ...(serving ? [new ReactRefreshWebpackPlugin({ overlay: false })] : []),
      new webpack.ProvidePlugin({
        process: 'process/browser', React: 'react', ReactDOM: 'react-dom', PropTypes: 'prop-types'
      }),
      new webpack.DefinePlugin({
        'process.env': JSON.stringify({
          NODE_ENV: production ? 'production' : 'development',
          PROJECT_VERSION: require('./package.json').version
        })
      })
    ]
  });
};
