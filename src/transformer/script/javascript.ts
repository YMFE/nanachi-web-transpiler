// import generate = require('@babel/generator');
import generate from '@babel/generator';
import parser = require('@babel/parser');
import traverse, { TraverseOptions } from '@babel/traverse';
import t from '@babel/types';
import Transpile from '../..';
import Asset from '../asset';

class JavaScriptTransformer extends Asset {
  public code: string = '';
  public sourceCode: string;

  protected transpile: Transpile;
  protected ast: t.File;
  protected traverseOptions: TraverseOptions = {};

  constructor(sourceFilePath: string, transpile: Transpile) {
    super(sourceFilePath, transpile);
  }

  protected traverse() {
    traverse(this.ast, this.traverseOptions);
  }

  protected registerTraverse(options: TraverseOptions) {
    Object.assign(this.traverseOptions, options);
  }

  protected async parse() {
    await this.read();
    this.sourceCode = this.content;

    try {
      this.ast = parser.parse(this.sourceCode, {
        sourceType: 'module',
        plugins: ['classProperties', 'jsx', 'dynamicImport'],
        sourceFilename: this.sourceFilePath
      });
    } catch (error) {
      // tslint:disable-next-line: no-console
      console.log(error);
    }
  }

  protected generate() {
    const { code } = generate(this.ast.program);
    this.code = this.content = code;
  }
}

export default JavaScriptTransformer;
