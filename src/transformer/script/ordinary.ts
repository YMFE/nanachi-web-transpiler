import template from '@babel/template';
import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import R from 'ramda';
import JavaScriptTransformer from './javascript';

interface InterfaceComponentsMap {
  [property: string]: string;
}

const webComponentsMap: InterfaceComponentsMap = {
  text: 'span',
  view: 'div',
  stack: 'div',
  block: 'div',
  'web-view': 'iframe',
  'scroll-view': 'div'
};

const nativeComponentsMap: InterfaceComponentsMap = {
  button: 'Button',
  checkbox: 'Checkbox',
  icon: 'Icon',
  progress: 'Progress',
  radio: 'Radio',
  'scorll-view': 'ScorllView',
  switch: 'Switch',
  'checkbox-group': 'CheckboxGroup',
  label: 'Label',
  'radio-group': 'RadioGroup'
};

const internalComponentsMap: InterfaceComponentsMap = {
  image: 'Image',
  slider: 'Slider',
  textarea: 'Textarea',
  swiper: 'Swiper',
  'swiper-item': 'SwiperItem',
  'rich-text': 'RichText',
  audio: 'Audio',
  picker: 'Picker'
};

const componentsNameMap: InterfaceComponentsMap = {
  ...webComponentsMap,
  ...nativeComponentsMap,
  ...internalComponentsMap
};

const importDynamicPageLoader = template(
  `import DynamicLoader from '@dynamic-loader';`
);

class OrdinaryJavaScript extends JavaScriptTransformer implements Transformer {
  private componentNameList: string[] = [];

  public async transform() {
    await this.parse();
    this.register();
    this.traverse();
    this.insertExternalComponents();
    this.insertInternalComponents();
    this.insertDynamicLoader();
    this.generate();
    await this.write();
  }

  private get isPage() {
    return /\/pages\//.test(this.sourceFilePath);
  }

  private get externalComponentsWaitingImported() {
    return this.componentNameList.filter(name => !!nativeComponentsMap[name]);
  }

  private get internalComponentsWaitingImported() {
    return this.componentNameList.filter(name => !!internalComponentsMap[name]);
  }

  private get program() {
    return this.ast.program;
  }

  private insertInternalComponents() {
    this.internalComponentsWaitingImported.forEach(name => {
      const variableName = componentsNameMap[name];
      const internalComponentName = `@internalComponents/${variableName}`;

      this.program.body.unshift(
        t.importDeclaration(
          [t.importDefaultSpecifier(t.identifier(variableName))],
          t.stringLiteral(internalComponentName)
        )
      );
    });
  }

  private insertDynamicLoader() {
    this.program.body.unshift(
      t.importDeclaration(
        [t.importDefaultSpecifier(t.identifier('DynamicPageLoader'))],
        t.stringLiteral('@dynamic-page-loader')
      )
    );
  }

  private insertExternalComponents() {
    this.externalComponentsWaitingImported.forEach(name => {
      const variableName = componentsNameMap[name];
      const externalComponentName = `schnee-ui/components/X${variableName}`;

      this.program.body.unshift(
        t.importDeclaration(
          [t.importDefaultSpecifier(t.identifier(variableName))],
          t.stringLiteral(externalComponentName)
        )
      );
    });
  }

  private addComponentName(name: string) {
    if (this.componentNameList.findIndex(v => v === name) === -1) {
      this.componentNameList.push(name);
    }
  }

  private register() {
    this.replaceAssets();
    this.replaceNodeName();
    this.autoBindThisForArrayMap();
    this.dynamicLoad();
  }

  private replaceNodeName() {
    this.registerTraverse({
      JSXOpeningElement: path => {
        const componentAttr = path.get('name');

        if (t.isJSXIdentifier(componentAttr)) {
          const componentName = (componentAttr.node as t.JSXIdentifier).name;
          const replaceName = componentsNameMap[componentName];

          this.addComponentName(componentName);

          if (replaceName) {
            (componentAttr.node as t.JSXIdentifier).name = replaceName;

            if (!path.node.selfClosing) {
              const closingElement = (path.container as t.JSXElement)
                .closingElement;

              ((closingElement as t.JSXClosingElement)
                .name as t.JSXIdentifier).name = replaceName;
            }
          }
        }
      }
    });
  }

  private dynamicLoad() {
    this.registerTraverse({
      ExportDefaultDeclaration: path => {
        const page = path.get('declaration');

        if (page.isFunctionDeclaration()) {
          page.replaceWith(
            t.callExpression(t.identifier('DynamicPageLoader'), [
              t.functionExpression(
                page.node.id,
                page.node.params,
                page.node.body,
                page.node.generator,
                page.node.async
              )
            ])
          );
        } else {
          // SPECIAL CASE
          // 组件不应该和 Page 也一样经过 DynamicPageLoader 函数包装
          if (this.isPage) {
            page.replaceWith(
              t.callExpression(t.identifier('DynamicPageLoader'), [
                page.node as t.Identifier
              ])
            );
          }
        }
      }
    });
  }

  private autoBindThisForArrayMap() {
    this.registerTraverse({
      ClassMethod: path => {
        if (
          path.get('key').isIdentifier({
            name: 'render'
          })
        ) {
          path.traverse({
            CallExpression: fn => {
              const callee = fn.get('callee');

              if (callee.isMemberExpression()) {
                const property = callee.get('property') as NodePath;

                if (property.isIdentifier()) {
                  if (property.node.name === 'map') {
                    const args = fn.node.arguments;

                    if (args.length < 2) {
                      args.push(t.thisExpression());
                    }
                  }
                }
              }
            },
            JSXAttribute: attr => {
              const name = attr.get('name');
              if (name.isJSXIdentifier()) {
                const attrName = name.node.name;

                if (/^catch/.test(attrName)) {
                  name.node.name = attrName.replace(/^catch/, 'on');
                }

                if (attrName === 'onTap') {
                  name.node.name = 'onClick';
                }
              }
            }
          });
        }
      }
    });
  }

  private replaceAssets() {
    this.registerTraverse({
      JSXAttribute: path => {
        const name = path.get('name');
        const value = path.get('value');
        const remoteUrlRegex = /^https?:\/\//;
        const assetsPathRegex = /(?:@?assets)([^\s]+)/;

        const isSrcJSXIdentifier = R.always(
          name.isJSXIdentifier({
            name: 'src'
          })
        );
        const isValueStringLiteral = (node: Node) => t.isStringLiteral(node);
        const isStringRemoteUrl = (node: t.StringLiteral) =>
          R.test(remoteUrlRegex, node.value);
        const isStringLocal = R.compose(
          R.not,
          isStringRemoteUrl
        );
        const isStringStartsWithAssets = (node: t.StringLiteral) =>
          R.test(assetsPathRegex, node.value);
        const shouldReplaceAssets = R.allPass([
          isSrcJSXIdentifier,
          isValueStringLiteral,
          isStringLocal,
          isStringStartsWithAssets
        ]);

        if (shouldReplaceAssets(value.node)) {
          const originalAssetsFilePath: string = (value.node as t.StringLiteral)
            .value;
          const [, replacedAssetsFilePath] = assetsPathRegex.exec(
            originalAssetsFilePath
          ) as string[];

          path
            .get('value')
            .replaceWith(
              t.jsxExpressionContainer(
                t.callExpression(t.identifier('require'), [
                  t.stringLiteral(`@assets${replacedAssetsFilePath}`)
                ])
              )
            );
        }
      }
    });
  }
}

export default OrdinaryJavaScript;
