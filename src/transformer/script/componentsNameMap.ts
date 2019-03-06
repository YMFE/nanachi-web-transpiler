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

export const nativeComponentsMap: InterfaceComponentsMap = {
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

export const internalComponentsMap: InterfaceComponentsMap = {
  image: 'Image',
  slider: 'Slider',
  textarea: 'Textarea',
  swiper: 'Swiper',
  'swiper-item': 'SwiperItem',
  'rich-text': 'RichText',
  audio: 'Audio',
  picker: 'Picker'
};

export const componentsNameMap: InterfaceComponentsMap = {
  ...webComponentsMap,
  ...nativeComponentsMap,
  ...internalComponentsMap
};
