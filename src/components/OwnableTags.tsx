import { Tag } from "@/components/ui";
import { ArrowRightLeft, Lock, LockOpen, PackageCheck, Zap } from "lucide-react";
import type { TagProps } from "@/components/ui/tag";

interface OwnableTagsProps {
  isLockable: boolean;
  isLocked: boolean;
  isConsumable: boolean;
  isConsumed: boolean;
  isTransferred: boolean;
  display?: TagProps["display"];
}

export default function OwnableTags({ isLockable, isLocked, isConsumable, isConsumed, isTransferred, display = "badge" }: OwnableTagsProps) {
  if (!isTransferred && !isLockable && !isConsumable) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {isTransferred && (
        <Tag display={display} variant="transferred" icon={<ArrowRightLeft className="h-3 w-3" />} value="Transferred" />
      )}
      {isLockable && (isLocked
        ? <Tag display={display} variant="locked" icon={<Lock className="h-3 w-3" />} value="Locked" />
        : <Tag display={display} variant="unlocked" icon={<LockOpen className="h-3 w-3" />} value="Unlocked" />
      )}
      {isConsumable && (isConsumed
        ? <Tag display={display} variant="consumed" icon={<PackageCheck className="h-3 w-3" />} value="Consumed" />
        : <Tag display={display} variant="consumable" icon={<Zap className="h-3 w-3" />} value="Consumable" />
      )}
    </div>
  );
}
