export default function debounce(func, timeout = 300) {
  let timer: NodeJS.Timeout;
  let isRunning = false;
  return (...args) => {
    if (isRunning) {
      console.log("There's a function running");
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      console.log("Is running marked to TRUE");
      isRunning = true;
      Promise.resolve(func.apply(this, args))
        .then((e) => {
          console.log("Is running marked to FALSE");
          isRunning = false;
          return e;
        })
        .catch(() => (isRunning = false));
    }, timeout);
  };
}
