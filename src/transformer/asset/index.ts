import fs from 'fs-extra';
import path from 'path';
import Transpile from '../..';

class Asset {
  public sourceFilePath: string;
  public destinationFilePath: string;
  public content: string;
  public relativePath: string;

  constructor(sourceFilePath: string, transpile: Transpile) {
    this.sourceFilePath = sourceFilePath;
    this.relativePath = path.relative(transpile.srcDirPath, sourceFilePath);
    this.destinationFilePath = path.resolve(
      transpile.destDirPath,
      this.relativePath
    );
  }

  public async read() {
    this.content = await fs.readFile(this.sourceFilePath, 'utf8');
  }

  public updateFileContent(content: string) {
    this.content = content;
  }

  public async write() {
    await fs.writeFile(this.destinationFilePath, this.content, 'utf8');
  }

  public async copy() {
    await fs.copyFile(this.sourceFilePath, this.destinationFilePath);
  }
}

export default Asset;
