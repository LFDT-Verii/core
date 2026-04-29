/* istanbul ignore file */

const dotenv = require('dotenv');

dotenv.config({ path: '.standalone.env', quiet: true });
dotenv.config({ path: '.localdev.env', quiet: true });

require('./main');
