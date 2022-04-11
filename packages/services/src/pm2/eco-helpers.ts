export const cron_1amDaily = '0 0 1 ? * * *';
export const seconds = (ms: number) => ms * 1000;
import pm2 from 'pm2';


export function pm2List(): Promise<pm2.ProcessDescription[]> {
  return new Promise<pm2.ProcessDescription[]>((resolve, reject) => {
    pm2.list(function (error: Error, ls: pm2.ProcessDescription[]) {
      if (error) {
        reject(error);
        return;
      }
      resolve(ls);
    });
  });
}

export async function pm2Restart(proc: string | number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    pm2.restart(proc, function (error: Error) {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export const pm2x = {
  //   connect: promisify(pm2.connect),
  //   disconnect: promisify(pm2.disconnect),
  //   start: promisify(pm2.start),
  //   stop: promisify(pm2.stop),
  //   reload: promisify(pm2.reload),
  restart: pm2Restart,
  list: pm2List
  //   delete: promisify(pm2.delete),
  //   describe: promisify(pm2.describe),
};

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
