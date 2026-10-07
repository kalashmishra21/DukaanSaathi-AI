import { cn } from "@/lib/utils/cn";

type StatusPillProps = {
  children: React.ReactNode;
  className?: string;
};

export function StatusPill({ children, className }: StatusPillProps) {
  return <span className={cn("status-pill", className)}>{children}</span>;
}
