import type { TypedPackageStub } from "@/interfaces/TypedPackage";

export const PACKAGE_EXAMPLE_URL = import.meta.env.VITE_OWNABLE_EXAMPLES_URL;

export const PACKAGE_EXAMPLES: TypedPackageStub[] = PACKAGE_EXAMPLE_URL
  ? [
      {
        title: "Antenna",
        name: "ownable-antenna",
        description: "Add-on for Robot",
        stub: true,
      },
      {
        title: "Armor",
        name: "ownable-armor",
        description: "Add-on for Robot",
        stub: true,
      },
      {
        title: "Car",
        name: "ownable-car",
        description: "Ride for HODLers",
        stub: true,
      },
      {
        title: "Paint",
        name: "ownable-paint",
        description: "Consumable for Robot",
        stub: true,
      },
      {
        title: "Potion",
        name: "ownable-potion",
        description: "Drink a colorful potion",
        stub: true,
      },
      {
        title: "Robot",
        name: "ownable-robot",
        description: "An adorable robot companion",
        stub: true,
      },
      {
        title: "Speakers",
        name: "ownable-speakers",
        description: "Add-on for Robot",
        stub: true,
      },
    ]
  : [];

export const HAS_EXAMPLES = PACKAGE_EXAMPLES.length > 0;
