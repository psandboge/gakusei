const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
module.exports = serving => ({
  mode: 'development', devtool: 'source-map',
  output: { filename: '[name].bundle.js' },
  devServer: {
    host: '127.0.0.1', port: Number(process.env.GAKUSEI_FRONTEND_PORT || 7777), hot: true, open: false, historyApiFallback: true,
    allowedHosts: ['localhost'], client: { overlay: { errors: true, warnings: false } },
    proxy: [{ context: ['/api', '/auth', '/logout', '/username', '/registeruser', '/license', '/icons', '/css', '/img', '/bootstrap'], target: `http://127.0.0.1:${process.env.GAKUSEI_BACKEND_PORT || 8080}` }]
  },
  plugins: [new HtmlWebpackPlugin({ filename: serving ? 'index.html' : '../../templates/index.html', template: path.resolve('src/main/resources/static/html/webpack_index.html') })]
});
