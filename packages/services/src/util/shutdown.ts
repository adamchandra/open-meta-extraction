export async function sigtraps(cb: () => Promise<void>): Promise<void> {
  return new Promise((resolve) => {
    process.once('SIGINT', () => {
      console.log('got SIGINT');
      return cb().then(resolve);
    });
    process.once('SIGTERM', () => {
      console.log('got SIGTERM');
      return cb().then(resolve);
    });
    process.once('SIGHUP', () => {
      console.log('got SIGHUP');
      return cb().then(resolve);
    });
    process.once('SIGUSR2', () => {
      console.log('got SIGUSR2');
      return cb().then(resolve);
    });
  });
}
