import { Link } from "@/components/ui";
import { HAS_EXAMPLES } from "../services/Package.service";
import { cva } from "class-variance-authority";
import { cn } from "../utils/cn";

const emptyStateLink = cva("pointer-events-auto link-primary underline");

interface GetStartedProps {
  onExamples: () => void;
}

export default function GetStarted({ onExamples }: GetStartedProps) {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center px-4">
      <div className="max-w-2xl text-center">
        <h1 className="text-page-title">Let's get started!</h1>
        <p className="text-body mt-4 text-base sm:text-2xl">
          Read{" "}
          <Link
            href="https://docs.ltonetwork.com/ownables/what-are-ownables"
            target="_blank"
            className={cn(emptyStateLink())}
          >
            the documentation
          </Link>{" "}
          to learn how to issue an Ownable
          {HAS_EXAMPLES && (
            <>
              <br />
              or try one of{" "}
              <Link
                href="#"
                onClick={(e) => { e.preventDefault(); onExamples(); }}
                className={cn(emptyStateLink())}
              >
                the examples
              </Link>
            </>
          )}
          .
          <br />
        </p>
      </div>
    </div>
  );
}
