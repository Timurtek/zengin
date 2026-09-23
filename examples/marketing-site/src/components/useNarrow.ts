import { useEffect, useState } from "react";

/** A width question the layout cannot answer, because the answer is a different set of positions. */
export function useNarrow(query = "(max-width: 52rem)"): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return narrow;
}
