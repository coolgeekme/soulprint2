const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: { background: './src/background/background.js', content: './src/content/content.jsx', popup: './src/popup/popup.jsx' },
  output: { path: path.resolve(__dirname, 'dist'), filename: '[name].js', clean: true },
  devtool: false,
  module: { rules: [
    { test: /\.[jt]sx?$/, exclude: /node_modules/, use: { loader: 'babel-loader', options: { presets: [['@babel/preset-env', { targets: { chrome: '114' } }], ['@babel/preset-react', { runtime: 'automatic' }]] } } },
    { test: /\.css$/, resourceQuery: /raw/, type: 'asset/source' },
    { test: /\.css$/, resourceQuery: { not: [/raw/] }, use: ['style-loader', 'css-loader'] }
  ] },
  resolve: { extensions: ['.js', '.jsx'] },
  plugins: [new CopyPlugin({ patterns: [
    { from: 'manifest.json', to: 'manifest.json' }, { from: 'src/popup/popup.html', to: 'popup.html' },
    { from: '../public/icon-48.png', to: 'icons/icon-48.png' }, { from: '../public/icon-128.png', to: 'icons/icon-128.png' }
  ] })]
};
