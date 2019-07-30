import { Compiler } from 'webpack';

class NodeHmrPlugin {
  public apply(compiler: Compiler): void {
    console.warn('Here we are!', Object.keys(compiler));
  }
}

export = NodeHmrPlugin;