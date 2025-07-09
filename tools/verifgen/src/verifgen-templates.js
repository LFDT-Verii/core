const console = require('console');
const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const common = require('./common');

const viewTemplates = (printTemplate) => {
  try {
    if (printTemplate) {
      const file = common.resolveTemplate(printTemplate);
      const fileContent = common.readFile(file, 'Failed to read template');

      console.info(fileContent);
    } else {
      const files = fs.readdirSync(common.templatesPath);

      files.forEach((file) => console.info(path.basename(file, '.json')));
    }
  } catch (ex) {
    common.printError(ex);
  }
};

program
  .name('verifgen templates')
  .description('View available sample templates')
  .usage('[options]')
  .option(
    '-p, --print-template <template-name>',
    'Prints content of sample template <template-name>'
  )
  .action(() => {
    const options = program.opts();
    return viewTemplates(options.printTemplate);
  })
  .parse(process.argv);
