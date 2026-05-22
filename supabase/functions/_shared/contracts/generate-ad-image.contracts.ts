/** Contrato do endpoint `generate-ad-image`. */
import { z } from "zod";
import type { ContractRegistry } from "./versioning.ts";

export const GenerateAdImageV1 = z
  .object({
    productImageUrl: z.string().url(),
    logoBase64: z.string().optional(),
    logoUrl: z.string().url().optional(),
    productName: z.string().optional(),
    productColor: z.string().optional(),
    techniqueName: z.string().optional(),
    locationName: z.string().optional(),
    scenePrompt: z.string().min(1, "Scene prompt is required"),
    sceneCategory: z.string().optional(),
    brandColorHex: z.string().optional(),
    brandColorName: z.string().optional(),
    campaignBrief: z.record(z.unknown()).optional(),
    outputChannel: z.string().optional(),
    aspectRatio: z.string().optional(),
    qualityMode: z.string().optional(),
    compositionMode: z.string().optional(),
    creativeMode: z.string().optional(),
    negativePrompt: z.array(z.string()).optional(),
    brandKit: z
      .object({
        primaryColor: z.string().nullable().optional(),
        secondaryColor: z.string().nullable().optional(),
        toneOfVoice: z.string().optional(),
        visualStyle: z.string().optional(),
        requiredWords: z.array(z.string()).optional(),
        forbiddenWords: z.array(z.string()).optional(),
        notes: z.string().optional(),
      })
      .optional(),
    refinementInstruction: z.string().nullable().optional(),
    batchVariant: z.record(z.unknown()).nullable().optional(),
    imageModel: z.enum(["pro", "fast"]).optional().default("pro"),
  })
  .refine((data) => data.logoBase64 || data.logoUrl, {
    message: "Either logoBase64 or logoUrl must be provided",
  });

export type GenerateAdImageV1Type = z.infer<typeof GenerateAdImageV1>;

export const contracts: ContractRegistry<"v1"> = {
  v1: {
    schema: GenerateAdImageV1,
    status: "stable",
    examples: {
      valid: [
        {
          productImageUrl: "https://cdn.example.com/p.png",
          scenePrompt: "Escritório moderno",
          logoUrl: "https://cdn.example.com/logo.png",
        },
      ],
      invalid: [
        { payload: {}, expectedPath: "productImageUrl" },
        {
          payload: { productImageUrl: "not-url", scenePrompt: "x", logoUrl: "https://x.com/l.png" },
          expectedPath: "productImageUrl",
        },
        {
          payload: {
            productImageUrl: "https://cdn.example.com/p.png",
            scenePrompt: "",
            logoUrl: "https://cdn.example.com/logo.png",
          },
          expectedPath: "scenePrompt",
        },
        {
          payload: {
            productImageUrl: "https://cdn.example.com/p.png",
            scenePrompt: "ok",
          },
          // Refine fail — path raiz vazio.
          expectedPath: "",
        },
      ],
    },
  },
};
