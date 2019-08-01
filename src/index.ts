import * as path from 'path';
import { Compiler } from 'webpack';
import { spawn, ChildProcess } from 'child_process';
import log from 'webpack-log';

const PLUGIN_NAME = 'node-hmr-plugin';

export enum LogLevel {
  TRACE = 'trace',
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  SILENT = 'silent'
}

export interface NodeHmrPluginOptions {
  // Command template string default: '{app}', can be for example '--inspect {app} some_arg'
  cmd?: string;
  // Exit code list that should be treated as signal to rerun app immediately, default: none
  restartOnExitCodes?: number[];
  // Log level, one of `trace`, `debug`, `info`, `warn`, `error`, `silent`, default: 'info'
  logLevel?: LogLevel;
}

interface NodeHmrPluginDefinedOptions {
  cmd: string;
  restartOnExitCodes: number[];
  logLevel: LogLevel;
}

class AppLauncher {
  private app: ChildProcess | null = null;
  private lastExitCode: number = 0;
  private isExitHookRegistered: boolean = false;
  private restartOnExitCodes: number[];
  private logger: any;

  public constructor(logger: any, restartOnExitCodes: number[]) {
    this.logger = logger;
    this.restartOnExitCodes = restartOnExitCodes;
  }

  private _ensureAppExitOnProcessExit() {
    if (!this.isExitHookRegistered) {
      process.on('exit', () => {
        if (this.app) {
          this.app.kill('SIGTERM');
          this.app = null;
        }
      });
      this.isExitHookRegistered = true;
    }
  }

  public runApp(appPath: string, cmd: string, onExitCallback: Function | null) {
    this._ensureAppExitOnProcessExit();

    const args = cmd.split(' ').map(str => (str === '{app}' ? appPath : str));
    this.app = spawn(process.execPath, [...args], {
      stdio: [0, 1, 2],
      env: { ...process.env, LAST_EXIT_CODE: `${this.lastExitCode}` }
    });
    this.logger.info(`${['node', ...args].join(' ')}, env: { LAST_EXIT_CODE: ${this.lastExitCode} }`);

    this.app.on('exit', (code: number): void => {
      this.app = null;
      this.lastExitCode = code;
      this.logger.info(`Node app stopped, exit code:`, code);
      if (this.restartOnExitCodes && this.restartOnExitCodes.includes(this.lastExitCode)) {
        this.runApp(appPath, cmd, onExitCallback);
      } else if (onExitCallback) {
        onExitCallback();
      }
    });
  }
}

class NodeHmrPlugin {
  private options: NodeHmrPluginDefinedOptions;
  private isWatching: boolean;
  private testMode: boolean;
  private launcher: AppLauncher;

  public constructor(options: NodeHmrPluginOptions = {}) {
    this.options = {
      cmd: options.cmd || '{app}',
      restartOnExitCodes: options.restartOnExitCodes || [],
      logLevel: options.logLevel || LogLevel.INFO
    };
    this.isWatching = false;
    this.testMode = false;

    const logger = log({ name: PLUGIN_NAME, level: this.options.logLevel });
    this.launcher = new AppLauncher(logger, this.options.restartOnExitCodes || []);
  }

  public apply(compiler: Compiler): void {
    compiler.hooks.watchRun.tapAsync(PLUGIN_NAME, (_, callback) => {
      this.isWatching = true;
      callback();
    });

    compiler.hooks.afterEmit.tapAsync(PLUGIN_NAME, (_, callback) => {
      if (this.isWatching && compiler.options.output && compiler.options.output.filename) {
        const appPath = path.join(compiler.outputPath, compiler.options.output.filename);
        this.launcher.runApp(appPath, this.options.cmd, this.testMode ? callback : null);
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
