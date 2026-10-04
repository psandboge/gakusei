const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
module.exports = () => ({
  mode: 'production', devtool: 'source-map', output: { filename: '[name].[contenthash].bundle.js' },
  module: { rules: [{ test: /\.jsx?$/, enforce: 'pre', exclude: /node_modules/, use: [{ loader: 'webpack-strip-block', options: { start: 'devcode:start', end: 'devcode:end' } }] }] },
  plugins: [new HtmlWebpackPlugin({ filename: '../../templates/index.html', template: path.resolve('src/main/resources/static/html/webpack_index.html') })]
});
