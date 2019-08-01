import * as fs from 'fs';
import * as path from 'path';
import * as tmp from 'tmp';
import webpack from 'webpack';
import waitForExpect from 'wait-for-expect';

import NodeHmrPlugin, { NodeHmrPluginOptions } from '..';

tmp.setGracefulCleanup();

const TEST_FILENAME = 'test.txt';
const createWebpack = (dir: string, options: NodeHmrPluginOptions = {}) =>
  webpack({
    mode: 'development',
    plugins: [new NodeHmrPlugin({ logLevel: 'error', ...options }), new webpack.HotModuleReplacementPlugin()],
    entry: { bundle: [require.resolve('webpack/hot/poll') + '?50', './entry.js'] },
    output: {
      path: path.join(dir, 'dist')
    },
    target: 'node'
  });

describe('node-hmr-plugin', () => {
  let dir: string;

  beforeEach(() => {
    dir = tmp.dirSync({ unsafeCleanup: true }).name;
    process.chdir(dir);
    if (fs.existsSync(TEST_FILENAME)) {
      fs.unlinkSync(TEST_FILENAME);
    }
  });

  it('should NOT launch node process in non-watch mode', done => {
    fs.writeFileSync(path.join(dir, 'entry.js'), `require('fs').writeFileSync('${TEST_FILENAME}', 1);`);

    const compiler = createWebpack(dir);

    compiler.run((err, stats) => {
      if (stats.hasErrors()) {
        console.error(stats.toString());
      }
      setTimeout(() => {
        expect(err).toBeNull();
        expect(stats.hasErrors()).toBeFalsy();
        expect(fs.existsSync(TEST_FILENAME)).toBeFalsy();
        done();
      }, 50);
    });
  });

  it('should launch node process in watch mode', done => {
    fs.writeFileSync(path.join(dir, 'entry.js'), `require('fs').writeFileSync('${TEST_FILENAME}', 1);`);

    const compiler = createWebpack(dir);

    const watching = compiler.watch({}, (err, stats) => {
      if (stats.hasErrors()) {
        console.error(stats.toString());
      }
      expect(err).toBeNull();
      expect(stats.hasErrors()).toBeFalsy();
    });

    waitForExpect(() => {
      expect(fs.existsSync(TEST_FILENAME)).toBeTruthy();
      watching.close(done);
    });
  });

  it('should launch node process with custom cmd template', done => {
    fs.writeFileSync(path.join(dir, 'entry.js'), `require('fs').writeFileSync('${TEST_FILENAME}', process.argv[2]);`);

    const compiler = createWebpack(dir, { cmd: '{app} foo' });

    const watching = compiler.watch({}, (err, stats) => {
      if (stats.hasErrors()) {
        console.error(stats.toString());
      }
      expect(err).toBeNull();
      expect(stats.hasErrors()).toBeFalsy();
    });

    waitForExpect(() => {
      expect(fs.existsSync(TEST_FILENAME)).toBeTruthy();
      expect(fs.readFileSync(TEST_FILENAME, 'utf8')).toEqual('foo');
      watching.close(done);
    });
  });

  it('should re-launch node process on given exit codes', done => {
    fs.writeFileSync(
      path.join(dir, 'entry.js'),
      `require('fs').writeFileSync('${TEST_FILENAME}', process.env.LAST_EXIT_CODE); process.exit(+process.env.LAST_EXIT_CODE + 1);`
    );

    const compiler = createWebpack(dir, { restartOnExitCodes: [0, 1, 2] });

    const watching = compiler.watch({}, (err, stats) => {
      if (stats.hasErrors()) {
        console.error(stats.toString());
      }
      expect(err).toBeNull();
      expect(stats.hasErrors()).toBeFalsy();
    });

    waitForExpect(() => {
      expect(fs.existsSync(TEST_FILENAME)).toBeTruthy();
      expect(fs.readFileSync(TEST_FILENAME, 'utf8')).toEqual('2');
      watching.close(done);
    });
  });

  it('should terminate long running app on watch close', done => {
    fs.writeFileSync(path.join(dir, 'entry.js'), `setTimeout(() => {}, 100000);`);
    const compiler = createWebpack(dir);

    const watching = compiler.watch({}, (err, stats) => {
      if (stats.hasErrors()) {
        console.error(stats.toString());
      }
      expect(err).toBeNull();
      expect(stats.hasErrors()).toBeFalsy();
      watching.close(done);
    });
  });

  it('should hot reload app code changes without app restart', done => {
    fs.writeFileSync(
      path.join(dir, 'entry.js'),
      `require('fs').writeFileSync('${TEST_FILENAME}', 'foo'); module.hot.accept(); setTimeout(() => {}, 100000);`
    );

    const compiler = createWebpack(dir);
    let codeModified = false;

    const watching = compiler.watch({}, (err, stats) => {
      if (stats.hasErrors()) {
        console.error(stats.toString());
      }
      expect(err).toBeNull();
      expect(stats.hasErrors()).toBeFalsy();
      if (!codeModified) {
        fs.writeFileSync(
          path.join(dir, 'entry.js'),
          `require('fs').writeFileSync('${TEST_FILENAME}', 'bar'); module.hot.accept(); setTimeout(() => {}, 100000);`
        );
        codeModified = true;
      }
    });

    waitForExpect(() => {
      expect(fs.readFileSync(TEST_FILENAME, 'utf8')).toEqual('bar');
      watching.close(done);
    });
  });
});
