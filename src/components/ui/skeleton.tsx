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
    // Generate a simple hash/id from className to help identify which skeleton part this is
    const skeletonId = `sk-${className?.split(" ").filter(c => !c.includes("h-") && !c.includes("w-")).join("-") || "base"}`;
    
    return (
      <div
        ref={ref}
        data-skeleton-id={skeletonId}
        className={cn(
          "relative overflow-hidden rounded-md bg-muted",
          className
        )}
        {...props}
      >
        {animate && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/5 to-transparent dark:via-white/5"
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
