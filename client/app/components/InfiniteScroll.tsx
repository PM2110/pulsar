import React, { useEffect, useRef } from "react";

interface InfiniteScrollProps {
  onIntersect: () => void;
  hasMore: boolean;
  isLoading: boolean;
  rootRef?: React.RefObject<HTMLElement | null>;
}

export const InfiniteScroll = ({ onIntersect, hasMore, isLoading, rootRef }: InfiniteScrollProps) => {
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!triggerRef.current || !hasMore || isLoading) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        onIntersect();
      }
    }, { 
      root: rootRef ? rootRef.current : null,
      rootMargin: "100px" 
    });

    observer.observe(triggerRef.current);
    
    return () => observer.disconnect();
  }, [onIntersect, hasMore, isLoading, rootRef]);

  if (!hasMore) return null;

  return (
    <div ref={triggerRef} style={{ padding: "16px 24px", textAlign: "center" }}>
      {isLoading ? (
        <span style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", gap: 8, justifyContent: "center", alignItems: "center" }}>
          <div className="spinner" style={{ width: 12, height: 12, borderWidth: "1.5px", borderTopColor: "var(--processing)" }} /> 
          Loading more...
        </span>
      ) : (
        <div style={{ height: 1 }} />
      )}
    </div>
  );
};
