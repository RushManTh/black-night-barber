import { defineCloudflareConfig } from '@opennextjs/cloudflare'

export default defineCloudflareConfig({
  // Skip incremental cache for MVP — add R2 bucket later if needed
  // See https://opennext.js.org/cloudflare/caching
})
