/* istanbul ignore file */

const dotenv = require('dotenv');

dotenv.config({ path: '.standalone.env' });
dotenv.config({ path: '.localdev.env' });

require('./main');
