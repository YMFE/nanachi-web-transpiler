import template from '@babel/template';
import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import JavaScriptTransformer from './javascript';

const importedPagesTemplatePrefixCode = template(`
import Loadable from 'react-loadable';
import QunarDefaultLoading from '@qunar-default-loading';
`);

class AppTransformer extends JavaScriptTransformer implements Transformer {
  private importedPages: t.Statement[];
  private exportedPages: t.ArrayExpression;
  private buildAsyncImport = template(
    `
  const PAGE_NAME = Loadable({
    loader: () => import('IMPORT_PATH'),
    loading: QunarDefaultLoading,
    delay: 300
  });`,
    {
      plugins: ['dynamicImport']
    }
  );
  private pageIndex: number = 0;

  public async transform() {
    await this.parse();
    this.init();
    this.register();
    this.traverse();
    this.generateExportedPagesCode();
    this.generate();
    await this.write();
  }

  private init() {
    this.importedPages = [];
    this.exportedPages = t.arrayExpression();
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
    this.requireTabIcons();
  }

  private generateExportedPagesCode() {
    const body = this.ast.program.body;

    body.unshift(...this.importedPages);
    body.unshift(
      ...(importedPagesTemplatePrefixCode() as t.ImportDeclaration[])
    );
    body.push(
      t.exportNamedDeclaration(
        t.variableDeclaration('const', [
          t.variableDeclarator(t.identifier('Pages'), this.exportedPages)
        ]),
        []
      )
    );
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

  private requireTabIcons() {
    this.registerTraverse({
      ClassProperty: path => {
        if (
          path.get('key').isIdentifier({
            name: 'config'
          })
        ) {
          path.traverse({
            Identifier: key => {
              const name = key.node.name;
              if (name === 'iconPath' || name === 'selectedIconPath') {
                const prop = key.findParent(t.isObjectProperty);
                const value = prop.get('value') as NodePath;
                value.replaceWith(
                  t.callExpression(t.identifier('require'), [
                    t.stringLiteral(`@${(value.node as t.StringLiteral).value}`)
                  ])
                );
              }
            }
          });
        }
      }
    });
  }

  private modifyAppConfig() {
    this.registerTraverse({
      ClassDeclaration: path => {
        path.get('superClass').remove();
      }
    });
  }

  private modifyExport() {
    this.registerTraverse({
      ExportDefaultDeclaration: path => {
        if (this.sourceFilePath === this.transpile.appJSPath) {
          const newApp = path.get('declaration').get('arguments');
          path
            .get('declaration')
            .replaceWith((newApp as any)[0].node);
        }
      }
    });
  }
}

export default AppTransformer;
