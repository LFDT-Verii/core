/* istanbul ignore file */
// eslint-disable-next-line import/no-extraneous-dependencies
const dotenv = require('dotenv');

dotenv.config({ path: '.standalone.env' });
dotenv.config({ path: '.localdev.env' });

require('./index');
