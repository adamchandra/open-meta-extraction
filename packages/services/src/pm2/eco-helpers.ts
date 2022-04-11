
const cwd = process.cwd();

export function appDef(name: string, script: string, args: string): Record<string, any> {
  return {
    name,
    script,
    args,
    cwd,
    env_testing: {
      NODE_ENV: "testing"
    },
    env_development: {
      NODE_ENV: "development"
    },
    env_production: {
      NODE_ENV: "production"
    },
  };
}

export interface CLIAppDef {
  name: string;
  args: string;
}

const cliScript = './dist/src/cli/index.js'


/**
 * Create a pm2-compatible ecosystem record, where the apps are all CLI-apps
 */
export function makeCLIEcosystem(appDefs: CLIAppDef[]): Record<string, any>[] {
  const ecoSystemList = appDefs.map(def => {
    return appDef(def.name, cliScript, def.args)
  });

  return ecoSystemList;
}
