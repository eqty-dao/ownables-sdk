import type { TypedPackageStub } from "@/interfaces/TypedPackage";
import examplePackages from "./example-packages.json";

export const PACKAGE_EXAMPLE_URL = import.meta.env.VITE_OWNABLE_EXAMPLES_URL;

export const PACKAGE_EXAMPLES: TypedPackageStub[] = PACKAGE_EXAMPLE_URL
  ? examplePackages.map((pkg): TypedPackageStub => ({ ...pkg, stub: true }))
  : [];

export const HAS_EXAMPLES = PACKAGE_EXAMPLES.length > 0;
