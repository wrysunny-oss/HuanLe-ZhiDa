const path = require('node:path');

const productConfigPath = process.env.REWARD_APP_PRODUCT_CONFIG
  ? path.resolve(process.env.REWARD_APP_PRODUCT_CONFIG)
  : path.resolve(__dirname, 'product.generated.json');
const productConfig = require(productConfigPath);

const groMoreEnabled = productConfig.modules.advertising
  && productConfig.advertising.provider === 'gromore';
const takuEnabled = (productConfig.modules.advertising
  && productConfig.advertising.provider === 'taku')
  || process.env.VERIFY_TAKU_SDK === 'true';

const dependencies = {};

if (!groMoreEnabled) {
  dependencies['react-native-playnest-unionad'] = {
    platforms: {android: null, ios: null},
  };
}

if (!takuEnabled) {
  dependencies['@taku_anythink/react-native-sdk'] = {
    platforms: {android: null, ios: null},
  };
}

module.exports = {
  dependencies,
};
