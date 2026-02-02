import { z } from "zod";

export const FileRefType = z
  .object({
    _file: z.string().min(1, "File path cannot be empty"),
  })
  .strict();

export type FileRef = z.infer<typeof FileRefType>;
