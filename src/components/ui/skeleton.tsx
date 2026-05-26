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
  ({ className, animate = true, ...props }, ref) => {
    React.useEffect(() => {
      if (process.env.NODE_ENV === 'development') {
        const id = props.id || props['data-testid'] || 'generic';
        // console.debug(`[Skeleton] Mounted: ${id}`);
      }
    }, [props.id, props['data-testid']]);

    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden rounded-md bg-muted/20",
          className
        )}
        data-skeleton="true"
        data-skeleton-id={props.id || props['data-testid'] || 'generic'}
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
