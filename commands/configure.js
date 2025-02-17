'use strict';

const inquirer = require('inquirer');

const helper = require('../lib/helper');

class Configure {
  constructor(app) {
    this.app = app;
    this.name = 'configure';
    this.description = 'configure signin url';
    this.useArgs = '0-n';
    this.options = {
      signinUrl: {
        required: false,
        description: 'silently configure the signin url'
      }
    };
  }

  async run(argv) {
    const config = helper.loadConfig();

    if (argv.signinUrl) {
      config.signinUrl = argv.signinUrl;
    } else {
      let question = {
        type: 'input',
        name: 'signinUrl',
        message: `please input 'signinUrl':`,
        default: config.signinUrl
      };
      const answer = await inquirer.prompt([question]);
      config.signinUrl = answer.signinUrl;
    }

    helper.saveConfig(config);
    console.log('configurate done!');
  }
}

module.exports = Configure;
