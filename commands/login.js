'use strict';

const os = require('os');

const open = require('open');
const kitx = require('kitx');
const inquirer = require('inquirer');

const SSO = require('../lib/sso');
const Portal = require('../lib/portal');
const helper = require('../lib/helper');
const { argv } = require('process');

class Login {
  constructor(app) {
    this.app = app;
    this.name = 'login';
    this.description = 'login with SSO account';
    this.useArgs = '0-n';
    this.options = {
      profile: {
        required: false,
        description: `the profile name, default: 'default'`
      },
      force: {
        required: false,
        description: 'ignore cached credential'
      },
      all: {
        required: false,
        description: 'get all accounts'
      },
      env: {
        required: false,
        description: 'print to environment variables'
      }
    };
  }

  async getAccessToken(ctx) {
    const signinUrl = ctx.signinUrl;
    const sso = new SSO({
      host: signinUrl.host,
      protocol: signinUrl.protocol,
      // 为特殊环境可替换配置
      clientId: process.env.ALIBABACLOUD_SSO_CLIENT_ID || 'app-vaz16tltdxs96audqf35',
      // 长度至少 43, md5 值 32 位，整体 64 位
      codeVerifier: kitx.makeNonce() + kitx.md5(os.hostname() + os.uptime() + process.uptime(), 'hex')
    });

    const result = await sso.startDeviceAuthorization({
      portalUrl: signinUrl.href
    });

    // open the browser
    await open(result.VerificationUriComplete);

    // eslint-disable-next-line max-len
    console.log(`If your default browser is not opened automatically, please use the following URL to finish the signin process.`);
    console.log();
    console.log(`Signin URL: ${result.VerificationUri}`);
    console.log(`User Code: ${result.UserCode}`);
    console.log();
    console.log(`And now you can login in your browser with you SSO account.`);

    const deviceCode = result.DeviceCode;
    // pending for login complete
    let response;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        response = await sso.createAccessToken({
          deviceCode: deviceCode
        });
        break;
      } catch (ex) {
        if (ex.code === 'AuthorizationPending') {
          await kitx.sleep(result.Interval * 1000);
          continue;
        }

        if (ex.code === 'InvalidDeviceCodeError') {
          console.error(`Your request has been expired, please login again.`);
          process.exit(-1);
        }

        throw ex;
      }
    }

    console.log(`You have logged in.`);

    return {
      // 提前10s过期
      expireTime: Date.now() + response.ExpiresIn - 10000,
      token: response.AccessToken
    };
  }

  async login(ctx) {
    const cache = ctx.cache;
    const profile = ctx.profile;
    if (!cache.accessToken || !cache.accessToken.expireTime || Date.now() >= cache.accessToken.expireTime) {
      cache.accessToken = await this.getAccessToken(ctx);
      helper.saveSTSCache(cache);
    }

    const accessToken = cache.accessToken.token;
    const url = ctx.signinUrl;
    var result;
    const portal = new Portal({
      host: url.host,
      protocol: url.protocol,
      accessToken: accessToken
    });

    let accountId, accessConfigurationId;
    // HOME : ADD DUMP ALL ACCOUNT
    if (ctx.all){
        console.log(`[ALL] Generate All token`);
        // 1
        const accounts = await portal.listAllAccounts();
        console.log(`[ACCOUNTS numbers:${accounts.length}]:`);
        console.log(accounts);
        // const token = accounts.map((d) => {
        //     d.DisplayName
        //     d.AccountId
        //     return {
        //         name: `${d.DisplayName}(${d.AccountId})`,
        //         value: d
        //     };
        //     });
        //2
        // https://advancedweb.hu/how-to-use-async-functions-with-array-map-in-javascript/

        const configs = await Promise.all(accounts.map(async (acc) => { return {
            name: `${acc.DisplayName}(${acc.AccountId})`,
            accountId : acc.AccountId,
            accessconf: await portal.listAllAccessConfigurations({
                accountId: acc.AccountId
            })
        }}));
        //3
        console.log(`[configs]`);
        console.log(JSON.stringify((configs)))
        const credentials = await Promise.all(configs.map(async (config) => { return {
            name: config.name,
            request: await portal.createCloudCredential({
                accountId: config.accountId,
                accessConfigurationId: config.accessconf[0].AccessConfigurationId
                })
            }
        }));
        console.log(`[createCloudCredential]`);
        console.log(JSON.stringify(credentials))
        result = credentials.map( (credential) => { return {
            name: credential.name,
            expireTime: new Date(credential.request.CloudCredential.Expiration).getTime(),
            data: {
                'mode': 'StsToken',
                'access_key_id': credential.request.CloudCredential.AccessKeyId,
                'access_key_secret': credential.request.CloudCredential.AccessKeySecret,
                'sts_token': credential.request.CloudCredential.SecurityToken
            }
            }
        });
        console.log(`[result]`);
        console.log(JSON.stringify(result))


    // RAM user / role / privilege 

    } else { 
        console.log(`[LOGIN] WITHOUT ALL PARAM`);
        if (cache.profiles[profile]) {
        // use the saved accountId, accessConfigurationId
        [accountId, accessConfigurationId] = cache.profiles[profile].split(':');
        } else {
        const accounts = await portal.listAllAccounts();

        if (accounts.length === 0) {
            console.error(`You don't have access to any account.`);
            process.exit(-1);
        }

        let sa;

        if (accounts.length > 1) {
            // 有多个账号时启动选择
            const choices = accounts.map((d) => {
            return {
                name: `${d.DisplayName}(${d.AccountId})`,
                value: d
            };
            });
            const account = await inquirer.prompt([{
            type: 'list',
            name: 'account',
            choices: choices,
            message: `You have ${accounts.length} accounts, please select one:`
            }]);
            sa = account.account;
        } else {
            sa = accounts[0];
        }

        accountId = sa.AccountId;
        console.log(`used account: ${sa.DisplayName}(${accountId})`);

        const configs = await portal.listAllAccessConfigurations({
            accountId: accountId
        });

        let selectedConfig;
        if (configs.length > 1) {
            const choices = configs.map((d) => {
            return {
                name: `${d.AccessConfigurationName}(${d.AccessConfigurationId})`,
                value: d
            };
            });
            const answers = await inquirer.prompt([{
            type: 'list',
            name: 'configuration',
            choices: choices,
            message: `You have ${configs.length} access configurations, please select one:`
            }]);
            selectedConfig = answers.configuration;
        } else {
            selectedConfig = configs[0];
        }

        accessConfigurationId = selectedConfig.AccessConfigurationId;
        console.log(`used access configuration: ${selectedConfig.AccessConfigurationName}(${accessConfigurationId})`);
        }

        const credential = await portal.createCloudCredential({
        accountId: accountId,
        accessConfigurationId: accessConfigurationId
        });

        result = {
        expireTime: new Date(credential.CloudCredential.Expiration).getTime(),
        data: {
            'mode': 'StsToken',
            'access_key_id': credential.CloudCredential.AccessKeyId,
            'access_key_secret': credential.CloudCredential.AccessKeySecret,
            'sts_token': credential.CloudCredential.SecurityToken
        }
        };

        // save into cache
        const cacheKey = `${accountId}:${accessConfigurationId}`;
        cache.current = profile;
        cache.profiles[profile] = cacheKey;
        cache.map[cacheKey] = {expireTime: result.expireTime, data: result.data};
        helper.saveSTSCache(cache);
    } 
    return result;
  }

  display(result, env) {
    if (env && result.hasOwnProperty("data")) {
      console.log(`export ALIBABACLOUD_ACCESS_KEY_ID=${result.data.access_key_id}`);
      console.log(`export ALIBABACLOUD_ACCESS_KEY_SECRET=${result.data.access_key_secret}`);
      console.log(`export SECURITY_TOKEN=${result.data.sts_token}`);
      console.log(`# for terraform`);
      console.log(`export ALICLOUD_ACCESS_KEY=${result.data.access_key_id}`);
      console.log(`export ALICLOUD_SECRET_KEY=${result.data.access_key_secret}`);
      console.log(`export ALICLOUD_SECURITY_TOKEN=${result.data.sts_token}`);
    } else {
        if (Array.isArray(result)) {
            console.log(JSON.stringify(result, null, 2));
        } else if (result.hasOwnProperty("data")){
            console.log(JSON.stringify(result.data, null, 2));
        }
    }
  }

  async run(argv) {
    const app = this.app;
    const cache = helper.loadSTSCache();
    const profile = argv.profile || cache.current || 'default';

    const config = helper.loadConfig();
    const signinUrl = config.signinUrl;
    if (!signinUrl) {
      console.error(`Please use '${app.name} configure' to set signin url.`);
      process.exit(-1);
    }

    const ctx = { cache, config, signinUrl: new URL(signinUrl), profile, all:argv.all };

    if (!argv.force) {
      // 没有强制登录，优先检查缓存
      const key = cache.profiles[profile];
      if (key) { // key 正常
        const sts = cache.map[key];
        if (sts && sts.expireTime > Date.now()) { // 有缓存且未过期
          this.display(sts.data, argv.env);
          return;
        }
      }
    }

    const result = await this.login(ctx);
    this.display(result, argv.env);
  }
}

module.exports = Login;
