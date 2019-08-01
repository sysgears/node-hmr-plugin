# Node HMR Webpack Plugin

[![Build Status](https://travis-ci.org/sysgears/webpack-virtual-modules.svg?branch=master)](https://travis-ci.org/sysgears/webpack-virtual-modules)
[![Twitter Follow](https://img.shields.io/twitter/follow/sysgears.svg?style=social)](https://twitter.com/sysgears)

**`node-hmr-plugin`** is a Webpack plugin that allows running your Node app during
development in such a way that it doesn't interfece with Webpack Hot Module Replacement.

When you utilize Webpack HMR during Node app development, the Webpack normally reloads
app code itself. You shouldn't watch for source code changes with external tool like `nodemon`, because Webpack will picks up changes itself and in more efficient mode.
However if your app crashes, it should be re-run after you changed source code and Webpack
compilation finishes. The plugin is exactly about supporting this workflow.

# Installation

Use Yarn or NPM to install Node HMR Webpack Plugin as a development dependency:

```bash
# with Yarn
yarn add -D node-hmr-plugin

# with NPM
npm install -D node-hmr-plugin
```

## Configuration

The plugin will do nothing in non-watch mode. In watch mode, the plugin will launch
node application and will try to restart it when application crashes and new code changes
were made.

**webpack.config.js**

```js
const NodeHmrPlugin = require('node-hmr-plugin');

module.exports = [
  target: 'node',
  ...
  plugins: [
    new HotModuleReplacementPlugin(),
    new NodeHmrPlugin()
  ]
};
```

## Plugin options

### cmd *(string) (default='{app}')*
Command template string default: `'{app}'`, it can be for example:
`'--inspect {app} some_arg'`. The `{app}` is replaced with actual path to the compiled bundle.

### restartOnExitCodes *(number[]) (default=none)*
Exit code list that should be treated as signal to rerun app immediately. It can be used
to handle the edge case when Webpack fails to apply HMR and you can have the code
like this inside your app:
```js
module.hot.status(event => {
  if (event === 'abort' || event === 'fail') {
    process.exit(250);
  }
});
```

and pass `restartOnExitCodes: [250]` option to the plugin to force immediate application
relaunch on HMR failure.

### logLevel *(string) (default='info')*
Log level, one of `trace`, `debug`, `info`, `warn`, `error`, `silent`. If you want to silence
plugin, pass `logLevel: 'info'` option.

## License

Copyright © 2019 [SysGears (Cyprus) Limited]. This source code is licensed under the [MIT] license.

[MIT]: LICENSE
[SysGears (Cyprus) Limited]: http://sysgears.com
