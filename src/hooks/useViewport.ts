import { useState, useCallback, useEffect } from "react";

const useViewport = () => {
  const [dimensions, apply] = useState({ width: 0, height: 0 });

  const setDimensions = useCallback(() => {
    apply({ width: window.innerWidth, height: window.innerHeight });
  }, []);
  // eslint-disable-next-line consistent-return
  useEffect(() => {
    if (typeof window !== "undefined") {
      setDimensions();
      window.addEventListener("scroll", setDimensions, { passive: true });
      window.addEventListener("resize", setDimensions, { passive: true });

      return () => {
        window.removeEventListener("scroll", setDimensions);
        window.removeEventListener("resize", setDimensions);
      };
    }
  }, [setDimensions]);

  return dimensions;
};

export default useViewport;
