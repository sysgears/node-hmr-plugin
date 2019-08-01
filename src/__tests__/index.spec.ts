import * as fs from 'fs';
import * as path from 'path';
import * as tmp from 'tmp';
import webpack from 'webpack';

import NodeHmrPlugin, { LogLevel } from '..';

tmp.setGracefulCleanup();

const TEST_FILENAME = 'test.txt';
const PLUGIN = new NodeHmrPlugin({ logLevel: LogLevel.ERROR });
(PLUGIN as any).testMode = true;

describe('node-hmr-plugin tests', () => {
  let dir: string;

  beforeEach(() => {
    dir = tmp.dirSync({ unsafeCleanup: true }).name;
    process.chdir(dir);
    if (fs.existsSync(TEST_FILENAME)) {
      fs.unlinkSync(TEST_FILENAME);
    }
    fs.writeFileSync(path.join(dir, 'entry.js'), `require('fs').writeFileSync('${TEST_FILENAME}', 1);`);
  });

  it('should NOT launch node process in non-watch mode', done => {
    const compiler = webpack({
      mode: 'development',
      plugins: [PLUGIN],
      entry: './entry.js',
      output: {
        path: path.join(dir, 'dist'),
        filename: 'bundle.js'
      },
      target: 'node'
    });

    compiler.run((err, stats) => {
      if (stats.hasErrors()) {
        console.error(stats.toString());
      }
      expect(err).toBeNull();
      expect(stats.hasErrors()).toBeFalsy();
      expect(fs.existsSync(TEST_FILENAME)).toBeFalsy();
      done();
    });
  });

  it('should launch node process in watch mode', done => {
    const compiler = webpack({
      mode: 'development',
      plugins: [PLUGIN],
      entry: './entry.js',
      output: {
        path: path.join(dir, 'dist'),
        filename: 'bundle.js'
      },
      target: 'node'
    });

    const watching = compiler.watch({}, (err, stats) => {
      if (stats.hasErrors()) {
        console.error(stats.toString());
      }
      expect(err).toBeNull();
      expect(stats.hasErrors()).toBeFalsy();
      expect(fs.existsSync(TEST_FILENAME)).toBeTruthy();
      watching.close(done);
    });
  });
});
