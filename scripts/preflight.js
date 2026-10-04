const { engines } = require('../package.json');
if (process.versions.node !== engines.node) throw new Error(`Use Node ${engines.node}; found ${process.versions.node}`);
const agent = process.env.npm_config_user_agent || '';
if (!agent.startsWith(`npm/${engines.npm} `)) throw new Error(`Use npm ${engines.npm}; found ${agent}`);
