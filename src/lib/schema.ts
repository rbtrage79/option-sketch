import { z } from "zod";

const PathPointSchema = z.object({
  dateISO: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD date string"),
  price: z.number().positive("Price must be positive"),
});

export const ScenarioSchema = z
  .object({
    kind: z.enum(["pointTarget", "path"]),
    symbol: z.string().min(1, "Symbol is required"),
    targetDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD date string"),
    targetPrice: z.number().positive().optional(),
    pathPoints: z.array(PathPointSchema).min(2).optional(),
    uncertaintyLevel: z.number().min(0).max(100),
  })
  .superRefine((data, ctx) => {
    if (data.kind === "pointTarget" && data.targetPrice === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "targetPrice is required for pointTarget scenario",
        path: ["targetPrice"],
      });
    }
    if (
      data.kind === "path" &&
      (!data.pathPoints || data.pathPoints.length < 2)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "path scenario requires at least 2 pathPoints",
        path: ["pathPoints"],
      });
    }
  });

export type ScenarioInput = z.infer<typeof ScenarioSchema>;

export function validateScenario(
  data: unknown
): { success: true; data: ScenarioInput } | { success: false; error: string } {
  const result = ScenarioSchema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  const firstError = result.error.errors[0];
  return {
    success: false,
    error: firstError
      ? `${firstError.path.join(".")}: ${firstError.message}`
      : "Invalid scenario",
  };
}
