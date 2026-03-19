const val = import.meta.env.VITE_E2E?.toLowerCase().trim();
export const isE2E = !!val && val !== "false" && val !== "0" && val !== "no" && val !== "off";
