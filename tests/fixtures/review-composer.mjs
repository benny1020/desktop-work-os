import { expect } from "@playwright/test";
// Human review is explicit. Line selection and restored drafts may already open it.
export async function openReviewComposer(page) {
  const editor = page.getByLabel("Diagram review comment", { exact: true });
  if (!await editor.isVisible()) await page.getByRole("button", { name: "Expand review composer", exact: true }).click();
  await expect(editor).toBeVisible();
}
