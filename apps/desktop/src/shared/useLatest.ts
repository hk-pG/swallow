import { useRef } from "react";

/** Holds the latest `value` without widening effect dependency lists when the caller changes every render. */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
