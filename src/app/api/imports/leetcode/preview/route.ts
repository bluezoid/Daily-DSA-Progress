import { z } from "zod";
import { authedRoute, json, readJson } from "@/lib/http/handler";
import { rateLimit } from "@/lib/auth/rate-limit";
import { previewLeetCodeImport } from "@/services/leetcode/importer";
import { findDuplicate } from "@/services/problems/problem.service";

// Upstream fetch is capped at 8s; leave headroom for the fallback request.
export const maxDuration = 20;

const schema = z.object({ url: z.string().trim().min(1, "Enter a URL").max(2048) });

export const POST = authedRoute(async (req, user) => {
  await rateLimit(`import:${user.id.toHexString()}`, 30, 60 * 60);
  const { url } = await readJson(req, schema);
  const result = await previewLeetCodeImport(url);
  const duplicate = result.canonicalUrl ? await findDuplicate(user, result.canonicalUrl) : null;
  return json({ ...result, duplicate });
});
