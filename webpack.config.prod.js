var webpack = require('webpack');
var webpackBaseConfig = require('./webpack-base-config');

webpackBaseConfig.plugins = [
    // Replace any occurance of process.env.NODE_ENV with the string 'production'
    new webpack.DefinePlugin({
        'process.env': {
            NODE_ENV: '\'production\'',
        },
    }),
    new webpack.optimize.DedupePlugin(),
    new webpack.optimize.OccurenceOrderPlugin(),
    new webpack.optimize.UglifyJsPlugin({
        compress: {
            warnings: false // Includes many warnings from 3rd party libraries
        },
        sourceMap: true,
    }),
];

module.exports = webpackBaseConfig;