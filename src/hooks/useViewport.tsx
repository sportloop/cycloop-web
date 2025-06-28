import {
  useState,
  useCallback,
  useEffect,
  createContext,
  useContext,
} from "react";

const defaultState = { width: 0, height: 0 };

const usePointerGlow = () => {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    const syncPointer = ({ x: pointerX, y: pointerY }) => {
      const x = pointerX.toFixed(2);
      const y = pointerY.toFixed(2);
      const xp = (pointerX / window.innerWidth).toFixed(2);
      const yp = (pointerY / window.innerHeight).toFixed(2);
      document.documentElement.style.setProperty("--x", x);
      document.documentElement.style.setProperty("--xp", xp);
      document.documentElement.style.setProperty("--y", y);
      document.documentElement.style.setProperty("--yp", yp);
      setStatus({ x, y, xp, yp });
    };
    document.body.addEventListener("pointermove", syncPointer);
    return () => {
      document.body.removeEventListener("pointermove", syncPointer);
    };
  }, []);
  return [status];
};

const useViewportInner = () => {
  const [dimensions, apply] = useState(defaultState);

  const setDimensions = useCallback(() => {
    apply({ width: window.innerWidth, height: window.innerHeight });
  }, []);

  useEffect(() => {
    setDimensions();
    window.addEventListener("resize", setDimensions, { passive: true });

    return () => {
      window.removeEventListener("resize", setDimensions);
    };
  }, [setDimensions]);

  return dimensions;
};

const ViewportContext = createContext(defaultState);

export function ViewportProvider({ children }) {
  const dimensions = useViewportInner();

  usePointerGlow();

  return (
    <ViewportContext.Provider value={dimensions}>
      {children}
    </ViewportContext.Provider>
  );
}

const useViewport = () => {
  const dimensions = useContext(ViewportContext);

  return dimensions;
};

export default useViewport;
