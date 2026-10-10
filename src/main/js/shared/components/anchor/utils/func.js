// Adapted from react-scrollable-anchor 0.6.1; MIT, see ../LICENSE.
exports.debounce = function(func, wait) {
  let timeout;
  const debounced = () => {
    clearTimeout(timeout);
    timeout = setTimeout(func, wait);
  };
  debounced.cancel = () => clearTimeout(timeout);
  return debounced;
};
