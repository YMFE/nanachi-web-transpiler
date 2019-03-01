import chokidar from 'chokidar';
import path from 'path';
import Asset from './transformer/asset';
import AppTransformer from './transformer/script/app';
import OrdinaryJavaScript from './transformer/script/ordinary';
import CSSTransformer from './transformer/style/css';

interface InterfaceTranspileConfig {
  cwd: string;
  srcRootDir: string;
  sourceDirName: string;
  intermediateRootDir: string;
  intermediateDirName: string;
}

interface InterfaceAssetsMap {
  [property: string]: OrdinaryJavaScript | CSSTransformer;
}

interface InterfaceStaticAssetsMap {
  [property: string]: Asset;
}

class Transpile {
  private static readonly ordinaryJavaScriptFile: symbol = Symbol(
    'Ordinary JavaScript file'
  );
  private static readonly appFile: symbol = Symbol('App JavaScript file');
  private static readonly cssFile: symbol = Symbol('CSS file');
  private static readonly staticFile: symbol = Symbol('Static file');

  private static isTransformable(type: symbol) {
    return type !== Transpile.staticFile;
  }

  public cwd: string;
  public srcRootDir: string;
  public sourceDirName: string;
  public intermediateRootDir: string;
  public intermediateDirName: string;
  public appJSPath: string;
  private staticAssetsMap: InterfaceStaticAssetsMap = {};
  private assetsMap: InterfaceAssetsMap = {};
  private watcher: chokidar.FSWatcher;

  constructor({
    cwd,
    srcRootDir,
    sourceDirName,
    intermediateDirName,
    intermediateRootDir
  }: InterfaceTranspileConfig) {
    this.cwd = cwd;
    this.srcRootDir = srcRootDir;
    this.sourceDirName = sourceDirName;
    this.intermediateDirName = intermediateDirName;
    this.intermediateRootDir = intermediateRootDir;
    this.appJSPath = path.resolve(
      this.srcRootDir,
      this.sourceDirName,
      'app.js'
    );
  }

  public get srcDirPath() {
    return path.resolve(this.srcRootDir, this.sourceDirName);
  }

  public get destDirPath() {
    return path.resolve(this.intermediateRootDir, this.intermediateDirName);
  }

  public async build() {
    try {
      await this.collectAndTranspile();
      this.watcher.close();
    } catch (error) {
      // tslint:disable-next-line: no-console
      console.log(error);
      process.exit();
    }
  }

  public async collectAndTranspile() {
    await this.collectAssets();
    await this.transformAllStaticAssets();
    await this.transformAllTransformableAssets();
  }

  public async watch() {
    await this.collectAndTranspile();

    this.watcher.on('change', filePath => this.onFileChange(filePath));
  }

  private get allAssets() {
    return {
      ...this.assetsMap,
      ...this.staticAssetsMap
    };
  }

  private async transformAllTransformableAssets() {
    const allFilePath = Object.keys(this.assetsMap);
    const allAssets = allFilePath.map(filePath => this.assetsMap[filePath]);

    return allAssets.map(asset => asset.transform());
  }

  private async transformAllStaticAssets() {
    const allFilePath = Object.keys(this.staticAssetsMap);
    const allStaticAssets = allFilePath.map(
      filePath => this.staticAssetsMap[filePath]
    );

    return allStaticAssets.map(asset => asset.copy());
  }

  private notifyWhenPromiseRejected(promise: Promise<void>) {
    promise.catch(error => {
      // tslint:disable-next-line no-console
      console.log(error);
    });
  }

  private distinguishFileType(sourceFilePath: string) {
    switch (true) {
      case sourceFilePath === this.appJSPath:
        return Transpile.appFile;

      case /\.js$/.test(sourceFilePath):
        return Transpile.ordinaryJavaScriptFile;

      case /\.(s?css|less)$/.test(sourceFilePath):
        return Transpile.cssFile;

      default:
        return Transpile.staticFile;
    }
  }

  private onAddFile(filePath: string) {
    const fileType = this.distinguishFileType(filePath);

    switch (fileType) {
      case Transpile.appFile:
        this.assetsMap[filePath] = new AppTransformer(filePath, this);
        break;

      case Transpile.ordinaryJavaScriptFile:
        this.assetsMap[filePath] = new OrdinaryJavaScript(filePath, this);
        break;

      case Transpile.cssFile:
        this.assetsMap[filePath] = new CSSTransformer(filePath, this);
        break;

      default:
        this.staticAssetsMap[filePath] = new Asset(filePath, this);
        break;
    }
  }

  private onFileChange(filePath: string) {
    const asset = this.allAssets[filePath];
    const type = this.distinguishFileType(filePath);

    if (Transpile.isTransformable(type)) {
      this.notifyWhenPromiseRejected((asset as OrdinaryJavaScript).transform());
    } else {
      this.notifyWhenPromiseRejected((asset as Asset).copy());
    }
  }

  private collectAssets() {
    return new Promise(resolve => {
      this.watcher = chokidar.watch(this.srcDirPath);
      this.watcher.on('add', filePath => this.onAddFile(filePath));
      this.watcher.on('ready', resolve);
      this.watcher.on('error', error =>
        this.notifyWhenPromiseRejected(Promise.reject(error))
      );
    });
  }
}

export default Transpile;

module.exports = Transpile;
