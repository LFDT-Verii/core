/* global __TRACING_ENABLED__ */

export const initTrace = (scope) => {
  const isEnabled =
    (typeof __TRACING_ENABLED__ !== 'undefined' && __TRACING_ENABLED__) ||
    import.meta.env?.DEV === true;

  return (payload) => {
    if (!isEnabled) {
      return;
    }

    // eslint-disable-next-line no-console
    console.debug(`[${scope}]`, payload);
  };
};
