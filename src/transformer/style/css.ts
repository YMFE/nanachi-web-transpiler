import Transpile from '../..';
import Asset from '../asset';

class CSSTransformer extends Asset implements Transformer {
  public code: string = '';
  public sourceCode: string;
  public relativePath: string;

  constructor(filePath: string, transpile: Transpile) {
    super(filePath, transpile);
  }

  public async transform() {
    await this.read();

    this.content = this.code = this.content.replace(
      /(\d+)rpx/g,
      (_, n) => `${n / 100}rem`
    );
  }
}

export default CSSTransformer;
