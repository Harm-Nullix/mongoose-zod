import { defineEventHandler, getQuery, createError } from "h3";
import fs from "node:fs/promises";
import path from "node:path";

export default defineEventHandler(async (event) => {
  if (process.env.LOCAL_MODE !== "true") {
    throw createError({
      statusCode: 403,
      message: "Local mode is not enabled.",
    });
  }

  const query = getQuery(event);
  const targetPath = query.path as string;

  if (!targetPath) {
    throw createError({
      statusCode: 400,
      message: "Path parameter is required.",
    });
  }

  try {
    // Resolve based on the directory where the CLI was invoked
    const absolutePath = path.resolve(process.cwd(), targetPath);

    // Ensure we are not breaking out of the working directory if strict bounds are needed
    // (Omitted here for brevity, but recommended in production)

    const fileContent = await fs.readFile(absolutePath, "utf-8");
    return { content: fileContent };
  } catch (error: any) {
    throw createError({
      statusCode: 404,
      message: `File not found: ${error.message}`,
    });
  }
});
