import * as path from 'path';
import { Compiler } from 'webpack';
import { spawn } from 'child_process';
import log from 'webpack-log';

const PLUGIN_NAME = 'node-hmr-plugin';

interface NodeHmrPluginOptions {
  inspect?: boolean;
  restartOnExitCodes?: number[];
  logLevel?: string;
}

class NodeHmrPlugin {
  private options: NodeHmrPluginOptions;
  private isWatching: boolean;
  private testMode: boolean;

  public constructor(options: NodeHmrPluginOptions = {}) {
    this.options = options;
    this.options.logLevel = this.options.logLevel || 'info';
    this.isWatching = false;
    this.testMode = false;
  }

  public apply(compiler: Compiler): void {
    const logger = log({ name: PLUGIN_NAME, level: this.options.logLevel });

    compiler.hooks.watchRun.tapAsync(PLUGIN_NAME, (_, callback) => {
      this.isWatching = true;
      callback();
    });

    let server;
    let lastExitCode = 0;
    process.on('exit', () => {
      if (server) {
        server.kill('SIGTERM');
      }
    });

    compiler.hooks.afterEmit.tapAsync(PLUGIN_NAME, (_, callback) => {
      if (this.isWatching) {
        const args = [path.join(compiler.outputPath, compiler.options.output.filename)];
        server = spawn(process.execPath, [...args], {
          stdio: [0, 1, 2],
          cwd: compiler.context,
          env: { ...process.env, LAST_EXIT_CODE: `${lastExitCode}` }
        });
        logger.info(`Spawning ${['node', ...args].join(' ')}, env: { LAST_EXIT_CODE: ${lastExitCode} }`);
        server.on('exit', code => {
          lastExitCode = code;
          // if (code === 250) {}
          logger.info(`Backend stopped, exit code:`, code);
          // server = undefined;
          // runServer(cwd, options.serverPath, options.nodeDebugger, logger);
          if (this.testMode) {
            callback();
          }
        });
        if (!this.testMode) {
          callback();
        }
      } else {
        callback();
      }
    });
  }
}

export default NodeHmrPlugin;
