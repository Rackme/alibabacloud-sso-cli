'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');

const SSO_CONFIG_FILE = path.join(os.homedir(), '.alibabacloud_sso');

function loadConfig() {
  if (fs.existsSync(SSO_CONFIG_FILE)) {
    const content = fs.readFileSync(SSO_CONFIG_FILE, 'utf8');
    return JSON.parse(content);
  }

  // give back default config
  return {};
}

function saveConfig(config) {
  fs.writeFileSync(SSO_CONFIG_FILE, JSON.stringify(config));
}

exports.loadConfig = loadConfig;
exports.saveConfig = saveConfig;

const SSO_STS = path.join(os.homedir(), '.alibabacloud_sso_sts');

function loadSTSCache() {
  if (fs.existsSync(SSO_STS)) {
    const content = fs.readFileSync(SSO_STS, 'utf8');
    const cache = JSON.parse(content);
    cache.map = cache.map || {};
    cache.profiles = cache.profiles || {};
    cache.accessToken = cache.accessToken || {};
    return cache;
  }

  return {
    // 当前 profile
    'current': '',
    'map': {},
    'profiles': {},
    'accessToken': {
      'token': '',
      'expireTime': ''
    }
  };
}

function saveSTSCache(config) {
  fs.writeFileSync(SSO_STS, JSON.stringify(config));
}

exports.loadSTSCache = loadSTSCache;
exports.saveSTSCache = saveSTSCache;

