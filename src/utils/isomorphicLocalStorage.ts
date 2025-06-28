const isServer = typeof window === "undefined";

const noop = () => {
  // do nothing
};

const returnNull = () => null;

const isomorphicLocalStorage: Storage = isServer
  ? {
      length: 0,
      clear: noop,
      getItem: returnNull,
      key: returnNull,
      removeItem: noop,
      setItem: noop,
    }
  : window.localStorage;

export default isomorphicLocalStorage;
