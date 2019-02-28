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

class OrdinaryJavaScript extends JavaScriptTransformer implements Transformer {
  private componentNameList: string[] = [];

  public async transform() {
    await this.parse();
    this.register();
    this.traverse();
    this.insertExternalComponents();
    this.insertInternalComponents();
    this.generate();
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
      const internalComponentName = `@internalComponents/${name}`;

      this.program.body.unshift(
        t.importDeclaration(
          [t.importDefaultSpecifier(t.identifier(name))],
          t.stringLiteral(internalComponentName),
          'value'
        )
      );
    });
  }

  private insertExternalComponents() {
    this.externalComponentsWaitingImported.forEach(name => {
      const externalComponentName = `schnee-ui/components/X${name}`;

      this.program.body.unshift(
        t.importDeclaration(
          [t.importDefaultSpecifier(t.identifier(name))],
          t.stringLiteral(externalComponentName),
          'value'
        )
      );
    });
  }

  private addComponentName(name: string) {
    if (this.componentNameList.findIndex(v => v === name) > -1) {
      this.componentNameList.push(name);
    }
  }

  private register() {
    this.replaceAssets();
    this.replaceNodeName();
  }

  private replaceNodeName() {
    this.registerTraverse({
      JSXOpeningElement: path => {
        const componentAttr = path.get('name');

        if (t.isJSXIdentifier(componentAttr)) {
          const componentName = componentAttr.name;
          const replaceName = componentsNameMap[componentName];

          this.addComponentName(componentName);

          if (replaceName) {
            componentAttr.name = replaceName;
          }

          if (!path.get('selfClosing')) {
            const closeElement = path.find(t.isJSXClosingElement);
            const componentCloseAttr = closeElement.get('name');

            if (t.isJSXIdentifier(componentCloseAttr)) {
              componentCloseAttr.name = replaceName;
            }
          }
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

          path.replaceWith(
            t.callExpression(t.identifier('require'), [
              t.stringLiteral(`@assets${replacedAssetsFilePath}`)
            ])
          );
        }
      }
    });
  }
}

export default OrdinaryJavaScript;
