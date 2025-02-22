export * from 'handsontable';

export { default } from 'handsontable';

import { registerLanguageDictionary, zhCN, enUS } from 'handsontable/i18n';

registerLanguageDictionary('zh-CN', zhCN);
registerLanguageDictionary('en-US', enUS);

import 'handsontable/styles/handsontable.css';
import 'handsontable/styles/ht-theme-main.css';
import 'handsontable/styles/ht-theme-horizon.css';