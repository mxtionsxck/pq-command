import { cn } from "@/lib/cn";

type SkeletonProps = Readonly<{
  className?: string;
}>;

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "h-4 animate-pulse rounded-full bg-white/8 motion-reduce:animate-none",
        className,
      )}
    />
  );
}
