
export async function sigtraps(cb: () => Promise<void>): Promise<void> {
  return new Promise((resolve) => {
    process.once('SIGINT', function() {
      console.log('got SIGINT')
      cb().then(resolve);
    });
    process.once('SIGTERM', function() {
      console.log('got SIGTERM')
      cb().then(resolve);
    });
    process.once('SIGHUP', function() {
      console.log('got SIGHUP')
      cb().then(resolve);
    });
    process.once('SIGUSR2', function() {
      console.log('got SIGUSR2')
      cb().then(resolve);
    });
  });
}
