import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Declare your Neon services here
  auth: false,
  // Product photos uploaded from the admin dashboard. Public read (shown on the shop), writes need
  // the server's credentials. Each upload gets a new key, so files can be cached forever.
  buckets: {
    "product-media": { access: "public_read" },
    // Licences and certificates (compliance centre). Private: staff download them through the server.
    documents: {},
  },
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }
    if (!branch.exists) {
      // New non-default branches: auto-expire
      // Run `neon checkout <name>` to create a new branch with these settings
      return { ttl: "7d" };
    }
    // Existing branch: no changes
    return {};
  },
});
