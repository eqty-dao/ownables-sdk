import { Tag } from "@/components/ui";
import { ArrowRightLeft, CircleOff, Lock, LockOpen, Zap } from "lucide-react";
import type { TagProps } from "@/components/ui/tag";
import { cn } from "@/utils/cn"

interface OwnableTagsProps {
  isClosable?: boolean;
  isClosed?: boolean;
  isLockable: boolean;
  isLocked: boolean;
  isConsumable: boolean;
  isConsumed: boolean;
  isTransferred: boolean;
  showUnlocked?: boolean;
  display?: TagProps["display"];
  className?: string;
}

export default function OwnableTags({
  isClosable = false,
  isClosed = false,
  isLockable,
  isLocked,
  isConsumable,
  isConsumed,
  isTransferred,
  showUnlocked = true,
  display = "badge",
  className,
}: OwnableTagsProps) {
  if (!isTransferred && !isLockable && !isConsumable && !isClosable) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-2.5', className)}>
      {isClosable && isClosed && (
        <Tag display={display} variant="closed" icon={<CircleOff className="h-3 w-3" />} value="Closed" />
      )}
      {isConsumable && (
        <Tag display={display} variant={isConsumed ? "consumed" : "consumable"} icon={<Zap className="h-3 w-3" />} value={isConsumed ? "Consumed" : "Consumable"} />
      )}
      {isTransferred && (
        <Tag display={display} variant="transferred" icon={<ArrowRightLeft className="h-3 w-3" />} value="Transferred" />
      )}
      {isLockable && isLocked && (
        <Tag display={display} variant="locked" icon={<Lock className="h-3 w-3" />} value="Locked" />
      )}
      {isLockable && !isLocked && showUnlocked && (
        <Tag display={display} variant="unlocked" icon={<LockOpen className="h-3 w-3" />} value="Unlocked" />
      )}
    </div>
  );
}
