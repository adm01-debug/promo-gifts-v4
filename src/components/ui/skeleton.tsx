import * as React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  animate?: boolean;
}

const shimmer = {
  initial: { x: "-100%" },
  animate: { x: "100%" },
  transition: {
    repeat: Infinity,
    duration: 1.5,
    ease: "easeInOut"
  }
};

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, animate = true, id, ...props }, ref) => {
    React.useEffect(() => {
      if (process.env.NODE_ENV === 'development') {
        const identifier = id || props['data-testid'] || 'generic';
        // In console, we can trace which skeletons are mounting
        if ((window as any).__DEBUG_SKELETONS__) {
          console.debug(`[Skeleton] Mounted: ${identifier}`, { className, props });
        }
      }
    }, [id, props['data-testid']]);

    return (
      <div
        ref={ref}
        id={id}
        className={cn(
          "relative overflow-hidden rounded-md bg-muted/20",
          className
        )}
        data-skeleton="true"
        data-skeleton-id={id || props['data-testid'] || 'generic'}
        {...props}
      >
        {animate && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-muted/10 to-transparent"
            initial={shimmer.initial}
            animate={shimmer.animate}
            transition={shimmer.transition}
          />
        )}
      </div>
    );
  }
);
Skeleton.displayName = "Skeleton";

export { Skeleton };