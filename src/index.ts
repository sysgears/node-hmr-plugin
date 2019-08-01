import * as path from 'path';
import { Compiler } from 'webpack';
import { spawn, ChildProcess } from 'child_process';
import log from 'webpack-log';

/** Plugin options */
export interface NodeHmrPluginOptions {
  // Command template string default: '{app}', can be for example '--inspect {app} some_arg'
  cmd?: string;
  // Exit code list that should be treated as signal to rerun app immediately, default: none
  restartOnExitCodes?: number[];
  // Log level, one of `trace`, `debug`, `info`, `warn`, `error`, `silent`, default: 'info'
  logLevel?: string;
}

/** The name of the plugin */
const PLUGIN_NAME = 'node-hmr-plugin';

interface NodeHmrPluginDefinedOptions {
  cmd: string;
  restartOnExitCodes: number[];
  logLevel: string;
}

/**
 * The class that manages Node app spawning and termination
 */
class AppLauncher {
  private app: ChildProcess | null = null;
  private lastExitCode: number = 0;
  private restartOnExitCodes: number[];
  private logger: any;

  public constructor(logger: any, restartOnExitCodes: number[]) {
    this.logger = logger;
    this.restartOnExitCodes = restartOnExitCodes;
  }

  public terminateApp() {
    if (this.app) {
      this.app.kill('SIGTERM');
      this.app = null;
    }
  }

  public runApp(appPath: string, cmd: string) {
    if (!this.app) {
      const args = cmd.split(' ').map(str => (str === '{app}' ? appPath : str));
      this.app = spawn(process.execPath, [...args], {
        stdio: [0, 1, 2],
        env: { ...process.env, LAST_EXIT_CODE: `${this.lastExitCode}` }
      });

      this.logger.info(`${['node', ...args].join(' ')}, env: { LAST_EXIT_CODE: ${this.lastExitCode} }`);

      this.app.on('exit', (exitCode: number): void => {
        this.app = null;
        this.lastExitCode = exitCode;
        this.logger.info(`Node app stopped, exit code:`, exitCode);
        if (this.restartOnExitCodes && this.restartOnExitCodes.includes(exitCode)) {
          this.runApp(appPath, cmd);
        }
      });
    }
  }
}

/** Node HMR Webpack Plugin */
class NodeHmrPlugin {
  private options: NodeHmrPluginDefinedOptions;
  private isWatching: boolean;
  private launcher: AppLauncher;

  public constructor(options: NodeHmrPluginOptions = {}) {
    this.options = {
      cmd: options.cmd || '{app}',
      restartOnExitCodes: options.restartOnExitCodes || [],
      logLevel: options.logLevel || 'info'
    };
    this.isWatching = false;

    const logger = log({ name: PLUGIN_NAME, level: this.options.logLevel });
    this.launcher = new AppLauncher(logger, this.options.restartOnExitCodes || []);
  }

  public apply(compiler: Compiler): void {
    compiler.hooks.watchClose.tap(PLUGIN_NAME, () => {
      this.launcher.terminateApp();
      this.isWatching = false;
    });

    compiler.hooks.watchRun.tapAsync(PLUGIN_NAME, (_, callback) => {
      this.isWatching = true;
      callback();
    });

    compiler.hooks.afterEmit.tapAsync(PLUGIN_NAME, (compilation, callback) => {
      if (this.isWatching) {
        const outputFilename = compilation.chunks[0].files[0];
        const appPath = path.join(compiler.outputPath, outputFilename);
        this.launcher.runApp(appPath, this.options.cmd);
      }
      callback();
    });
  }
}

export default NodeHmrPlugin;

module.exports = NodeHmrPlugin;
