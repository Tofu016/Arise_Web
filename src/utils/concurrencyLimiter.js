// A plain FIFO semaphore: at most `max` of the functions passed to the
// returned `run()` are ever in flight at once, the rest wait their turn.
// Used to stop a page that mounts many independent async fetches at once
// (e.g. every node in a flowchart requesting its own photo) from saturating
// the network and spiking decode work all in the same tick.
export function createLimiter(max) {
  let active = 0;
  const queue = [];

  function next() {
    if (active >= max || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn().then(
      (value) => {
        active--;
        resolve(value);
        next();
      },
      (err) => {
        active--;
        reject(err);
        next();
      }
    );
  }

  return function run(fn) {
    return new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
  };
}
