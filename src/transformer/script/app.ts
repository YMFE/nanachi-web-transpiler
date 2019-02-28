import generate from '@babel/generator';
import template from '@babel/template';
import * as t from '@babel/types';
import JavaScriptTransformer from './javascript';

const importedPagesTemplatePrefixCode = `
import Loadable from 'react-loadable';
import DEFAULT_LOADING from 'DEFAULT_LOADING';
`;

class AppTransformer extends JavaScriptTransformer implements Transformer {
  public exportedPagesCode: string;

  private importedPages: t.Statement[] = [];
  private exportedPages: t.ArrayExpression = t.arrayExpression();
  private buildAsyncImport = template(`
  const PAGE_NAME = Loadable({
    loader: () => import('IMPORT_PATH'),
    loading: DEFAULT_LOADING,
  });`, {
    plugins: ['dynamicImport']
  });
  private pageIndex: number = 0;

  public async transform() {
    await this.parse();
    this.register();
    this.traverse();
    this.generate();
    this.generateExportedPagesCode();
  }

  private loadable(importPath: string) {
    const pageName = `Page_${this.pageIndex++}`;
    const pageItem = t.objectExpression([
      t.objectProperty(
        t.identifier('url'),
        t.stringLiteral(importPath.slice(1))
      ),
      t.objectProperty(t.identifier('Comp'), t.identifier(pageName))
    ]);

    this.exportedPages.elements.push(pageItem);

    return this.buildAsyncImport({
      IMPORT_PATH: importPath,
      PAGE_NAME: pageName
    });
  }

  private register() {
    this.extractPages();
    this.modifyAppConfig();
    this.modifyExport();
  }

  private generateExportedPagesCode() {
    const importPagesCode = generate(t.program(this.importedPages)).code;
    const exportAst = t.exportDefaultDeclaration(this.exportedPages);
    const exportPagesCode = generate(exportAst).code;

    this.exportedPagesCode = `
    ${importedPagesTemplatePrefixCode}
    ${importPagesCode}
    ${exportPagesCode}
    `;
  }

  private extractPages() {
    this.registerTraverse({
      ImportDeclaration: path => {
        const importPath = path.node.source.value;

        if (importPath.startsWith('./pages')) {
          this.importedPages.push(this.loadable(importPath) as t.Statement);
          path.remove();
        }
      }
    });
  }

  private modifyAppConfig() {
    this.registerTraverse({
      ClassDeclaration: path => {
        const AppConfig = t.classDeclaration(
          t.identifier('AppConfig'),
          null,
          path.get('body').node
        );

        path.replaceWith(AppConfig);
      }
    });
  }

  private modifyExport() {
    this.registerTraverse({
      ExportDefaultDeclaration: path => {
        const exportAppConfig = t.exportDefaultDeclaration(
          t.newExpression(t.identifier('AppConfig'), [])
        );
        path.replaceWith(exportAppConfig);
      }
    });
  }
}

export default AppTransformer;
