import { Tag } from "@/components/ui";
import { ArrowRightLeft, Lock, LockOpen, Zap } from "lucide-react";
import type { TagProps } from "@/components/ui/tag";
import { cn } from "@/utils/cn"

interface OwnableTagsProps {
  isLockable: boolean;
  isLocked: boolean;
  isConsumable: boolean;
  isConsumed: boolean;
  isTransferred: boolean;
  showUnlocked?: boolean;
  display?: TagProps["display"];
  className?: string;
}

export default function OwnableTags({ isLockable, isLocked, isConsumable, isConsumed, isTransferred, showUnlocked = true, display = "badge", className }: OwnableTagsProps) {
  if (!isTransferred && !isLockable && !isConsumable) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-2.5', className)}>
      {isConsumable && (isConsumed
          ? <Tag display={display} variant="consumed" icon={<Zap className="h-3 w-3" />} value="Consumed" />
          : <Tag display={display} variant="consumable" icon={<Zap className="h-3 w-3" />} value="Consumable" />
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
