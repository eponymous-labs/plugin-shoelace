// Based on systemjs/plugin-babel
// Note that this file is strictly ES5, as it can't be transpiled as it's the transpiler

var babel = require('babel-core')
var pipeline = new babel.Pipeline;

SystemJS._loader.loadedTranspilerRuntime = true;

function identity(x){ return x }

function parse(code, options){
  if(!options) options = {};
  options.source = code;

  var babelOptions = {
    sourceMaps: true,
    compact: 'auto',
    comments: true
  };

  var presets = []

  var es2015 = require('babel-preset-es2015')
  if(options.systemjs){
    presets.push([es2015.buildPreset, { "modules": "systemjs" }])
  }else{
    presets.push([es2015.buildPreset, { "modules": false }])
  }

  presets.push(require('babel-preset-stage-0'))
  presets.push(require('babel-preset-react'))

  var plugins = [
    require('babel-plugin-transform-decorators-legacy').default, 
    // require('babel-plugin-transform-runtime').default
    require('babel-plugin-top-level-await').default,
    require('babel-plugin-uncommon-transform').default
  ]

  var pluginLoader = options.loader || System;

  var transformer = options.dev || {}

  return Promise.resolve(transformer).then(function(mod){
    var file = pipeline.pretransform(code, (mod.manipulateOptions || identity)({
      babelrc: false,
      plugins: plugins,
      presets: presets,
      filename: options.filename,
      moduleIds: false,
      sourceMaps: babelOptions.sourceMaps,
      inputSourceMap: options.sourceMap,
      compact: babelOptions.compact,
      comments: babelOptions.comments,
      code: true,
      ast: true,
    }, options))
    file.__posttransform = mod.posttransform || identity;
    return (mod.pretransform || identity)(file, options);
  })
}

exports.parse = parse;

exports.translate = function(load, traceOpts) {
  // we don't transpile anything other than CommonJS or ESM
  if (load.metadata.format == 'global' || load.metadata.format == 'amd' || load.metadata.format == 'json'){
    throw new TypeError('plugin-babel cannot transpile ' + load.metadata.format + ' modules. Ensure "' + load.name + '" is configured not to use this loader.');
  }

  var loader = this;
  var pluginLoader = loader.pluginLoader || loader;
  // we only output ES modules when running in the builder
  var outputESM = traceOpts ? traceOpts.outputESM : loader.builder;

  var options = {
    systemjs: !(outputESM || load.metadata.format == 'cjs'),
    dev: load.metadata.dev,
    sourceMap: load.metadata.sourceMap,
    filename: load.address,
    loader: pluginLoader,
    cell: load.metadata.cell
  }

  return parse(load.source, options).then(function(file){
    var output = file.__posttransform(file.transform(), options)

    // set output module format
    // (in builder we output modules as esm)
    if (!load.metadata.format || load.metadata.format == 'detect' || load.metadata.format == 'esm'){
      load.metadata.format = outputESM ? 'esm' : 'register';
    }

    load.metadata.sourceMap = output.map;

    return output.code;
  })
}

