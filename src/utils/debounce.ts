// Debounce helper to prevent excessive rebuilds
export function debounce(fn: Function, delay: number) {
  let timer: NodeJS.Timeout;

  return (...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
