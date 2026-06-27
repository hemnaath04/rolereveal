// SPA route-change detection. Content scripts run in an isolated world and can't
// reliably intercept the page's own history.pushState, so we poll location.href
// (cheap) and also listen for popstate.
export function onRouteChange(cb: () => void): () => void {
  let last = location.href;
  const check = () => {
    if (location.href !== last) {
      last = location.href;
      cb();
    }
  };
  const interval = window.setInterval(check, 500);
  window.addEventListener('popstate', check);
  return () => {
    clearInterval(interval);
    window.removeEventListener('popstate', check);
  };
}
